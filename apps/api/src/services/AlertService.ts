import { getDb } from '../lib/db.js';
import { AlertRecord, AlertState } from '@nexusflow/shared';
import { MockNotifier, INotifier } from '@nexusflow/notifiers';

export interface AlertFilterOptions {
  state?: AlertState;
  severity?: string;
  deviceId?: string;
  workflowId?: string;
  limit?: number;
  skip?: number;
}

export type AlertBroadcaster = (event: {
  type: 'ALERT_CREATED' | 'ALERT_UPDATED' | 'ALERT_ACKNOWLEDGED' | 'ALERT_RESOLVED';
  alert: AlertRecord;
}) => void;

export class AlertService {
  private static notifier: INotifier = new MockNotifier();
  private static broadcaster: AlertBroadcaster | null = null;

  static setNotifier(customNotifier: INotifier): void {
    this.notifier = customNotifier;
  }

  static getNotifier(): INotifier {
    return this.notifier;
  }

  static setBroadcaster(broadcaster: AlertBroadcaster): void {
    this.broadcaster = broadcaster;
  }

  static async handleBreachEvent(input: {
    tenantId: string;
    workflowId: string;
    workflowVersion: number;
    executionId: string;
    nodeId: string;
    deviceId: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    condition: string;
    observedValue: number;
    threshold: number;
    cooldownSeconds: number;
    channel?: string;
    recipients?: string[];
  }): Promise<AlertRecord> {
    const db = getDb();
    const dedupKey = `${input.tenantId}:${input.workflowId}:${input.nodeId}:${input.deviceId}`;
    const now = new Date().toISOString();
    const nowMs = Date.now();

    const alertsCol = db.collection<AlertRecord>('alerts');

    // Find any current un-resolved alert
    const existing = await alertsCol.findOne({
      tenantId: input.tenantId,
      dedupKey,
      state: { $in: ['PENDING', 'FIRING', 'ACKNOWLEDGED'] },
    });

    if (existing) {
      // Cooldown check
      const lastFiringMs = existing.firingAt ? new Date(existing.firingAt).getTime() : 0;
      const cooldownMs = input.cooldownSeconds * 1000;
      const isCooldownActive = nowMs - lastFiringMs < cooldownMs;

      // Update existing active alert with latest observed reading
      await alertsCol.updateOne(
        { id: existing.id },
        {
          $set: {
            observedValue: input.observedValue,
            updatedAt: now,
          },
        }
      );

      const updated = { ...existing, observedValue: input.observedValue, updatedAt: now };

      // Re-notify only if cooldown expired
      if (!isCooldownActive && existing.state === 'FIRING') {
        await this.dispatchNotification(updated, input.recipients);
      }

      if (this.broadcaster) {
        this.broadcaster({ type: 'ALERT_UPDATED', alert: updated });
      }

      return updated;
    }

    // New breach -> Transition to FIRING
    const alertId = `alt-${input.workflowId}-${input.deviceId}-${nowMs}`;
    const newAlert: AlertRecord = {
      id: alertId,
      tenantId: input.tenantId,
      workflowId: input.workflowId,
      workflowVersion: input.workflowVersion,
      executionId: input.executionId,
      nodeId: input.nodeId,
      deviceId: input.deviceId,
      state: 'FIRING',
      severity: input.severity,
      title: input.title,
      condition: input.condition,
      observedValue: input.observedValue,
      threshold: input.threshold,
      dedupKey,
      createdAt: now,
      updatedAt: now,
      firingAt: now,
      notificationSent: false,
      notificationChannel: input.channel || 'mock',
    };

    await alertsCol.insertOne(newAlert);

    // Dispatch notification
    await this.dispatchNotification(newAlert, input.recipients);

    if (this.broadcaster) {
      this.broadcaster({ type: 'ALERT_CREATED', alert: newAlert });
    }

    return newAlert;
  }

  private static async dispatchNotification(alert: AlertRecord, recipients?: string[]): Promise<void> {
    try {
      const receipt = await this.notifier.send({
        alertId: alert.id,
        workflowId: alert.workflowId,
        deviceId: alert.deviceId,
        severity: alert.severity,
        title: alert.title,
        channel: 'mock',
        recipients: recipients || ['operator@factory.local'],
        message: `Alert: ${alert.title} on device ${alert.deviceId}. Observed value: ${alert.observedValue}`,
      });

      if (receipt.status === 'delivered') {
        const db = getDb();
        await db.collection('alerts').updateOne(
          { id: alert.id },
          { $set: { notificationSent: true } }
        );
      }
    } catch (err) {
      console.error('Notification dispatch failure (non-blocking):', err);
    }
  }

  static async acknowledgeAlert(tenantId: string, alertId: string, user: string): Promise<AlertRecord | null> {
    const db = getDb();
    const now = new Date().toISOString();

    const res = await db.collection<AlertRecord>('alerts').findOneAndUpdate(
      { tenantId, id: alertId, state: 'FIRING' },
      {
        $set: {
          state: 'ACKNOWLEDGED',
          acknowledgedAt: now,
          acknowledgedBy: user,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' }
    );

    if (res && this.broadcaster) {
      this.broadcaster({ type: 'ALERT_ACKNOWLEDGED', alert: res });
    }

    return res ?? null;
  }

  static async resolveAlert(tenantId: string, alertId: string, user: string = 'system'): Promise<AlertRecord | null> {
    const db = getDb();
    const now = new Date().toISOString();

    const res = await db.collection<AlertRecord>('alerts').findOneAndUpdate(
      { tenantId, id: alertId, state: { $in: ['FIRING', 'ACKNOWLEDGED'] } },
      {
        $set: {
          state: 'RESOLVED',
          resolvedAt: now,
          resolvedBy: user,
          updatedAt: now,
        },
      },
      { returnDocument: 'after' }
    );

    if (res && this.broadcaster) {
      this.broadcaster({ type: 'ALERT_RESOLVED', alert: res });
    }

    return res ?? null;
  }

  static async listAlerts(tenantId: string, filters: AlertFilterOptions = {}): Promise<AlertRecord[]> {
    const db = getDb();
    const query: Record<string, unknown> = { tenantId };

    if (filters.state) query.state = filters.state;
    if (filters.severity) query.severity = filters.severity;
    if (filters.deviceId) query.deviceId = filters.deviceId;
    if (filters.workflowId) query.workflowId = filters.workflowId;

    const limit = Math.min(filters.limit ?? 50, 200);
    const skip = filters.skip ?? 0;

    return db
      .collection<AlertRecord>('alerts')
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }
}
