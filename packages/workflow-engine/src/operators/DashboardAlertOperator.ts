import { IOperator, EngineMessage, OperatorOutput, OperatorContext } from './types.js';
import { DashboardAlertConfig } from '../registry/nodes.js';

export interface AlertEventPayload {
  alertId: string;
  workflowId: string;
  nodeId: string;
  deviceId: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  timestamp: string;
  eventTimeMs: number;
  observedValue: number;
  threshold: number;
  condition: string;
}

export class DashboardAlertOperator implements IOperator {
  readonly id: string;
  readonly type = 'dashboard-alert';
  private config: DashboardAlertConfig;
  private context: OperatorContext;
  private lastAlertTimeMs = new Map<string, number>();

  constructor(context: OperatorContext, config: DashboardAlertConfig) {
    this.id = context.nodeId;
    this.context = context;
    this.config = config;
  }

  process(_inputPort: string, message: EngineMessage<boolean>): OperatorOutput[] {
    const isTriggered = Boolean(message.value);
    if (!isTriggered) {
      return [];
    }

    const lastAlert = this.lastAlertTimeMs.get(message.deviceId);
    const cooldownMs = (this.config.cooldownSeconds ?? 60) * 1000;

    // Suppress if within cooldown window
    if (lastAlert !== undefined && message.eventTimeMs - lastAlert < cooldownMs) {
      return [];
    }

    this.lastAlertTimeMs.set(message.deviceId, message.eventTimeMs);

    const alertEvent: AlertEventPayload = {
      alertId: `alt-${this.context.workflowId}-${message.deviceId}-${message.eventTimeMs}`,
      workflowId: this.context.workflowId,
      nodeId: this.id,
      deviceId: message.deviceId,
      severity: this.config.severity,
      title: this.config.title,
      timestamp: message.timestamp,
      eventTimeMs: message.eventTimeMs,
      observedValue: Number(message.metadata?.observedValue ?? 0),
      threshold: Number(message.metadata?.threshold ?? 0),
      condition: String(message.metadata?.operator ?? '>'),
    };

    return [
      {
        portId: 'alertEvent',
        message: {
          deviceId: message.deviceId,
          timestamp: message.timestamp,
          eventTimeMs: message.eventTimeMs,
          value: alertEvent,
          metadata: {
            ...message.metadata,
            severity: this.config.severity,
            title: this.config.title,
          },
        },
      },
    ];
  }

  reset(): void {
    this.lastAlertTimeMs.clear();
  }
}
