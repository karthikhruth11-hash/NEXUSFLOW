import { WorkflowRuntime } from '@nexusflow/workflow-engine';
import { WorkflowService, WorkflowRecord } from './WorkflowService.js';
import { telemetryBus } from '../adapters/TelemetryBus.js';
import { AlertService } from './AlertService.js';
import { IngestedTelemetryRecord } from '@nexusflow/shared';

export type LiveOverlayBroadcaster = (event: {
  type: 'NODE_LIVE_OUTPUT';
  workflowId: string;
  deviceId: string;
  nodeId: string;
  portId: string;
  value: unknown;
  timestamp: string;
}) => void;

export class RuntimeManager {
  private static activeRuntimes = new Map<string, WorkflowRuntime>();
  private static busUnsubscribers = new Map<string, () => void>();
  private static liveOverlayBroadcaster: LiveOverlayBroadcaster | null = null;

  static setLiveOverlayBroadcaster(broadcaster: LiveOverlayBroadcaster): void {
    this.liveOverlayBroadcaster = broadcaster;
  }

  static async startWorkflow(tenantId: string, workflowId: string): Promise<WorkflowRecord> {
    const workflow = await WorkflowService.getWorkflow(tenantId, workflowId);
    if (!workflow) {
      throw new Error(`Workflow '${workflowId}' not found`);
    }

    // Stop existing runtime if any
    this.stopWorkflow(tenantId, workflowId);

    const runtime = new WorkflowRuntime(workflowId, workflow.graph);
    runtime.start();

    // Hook alert events to AlertService
    runtime.onAlert(async (alert) => {
      await AlertService.handleBreachEvent({
        tenantId,
        workflowId,
        workflowVersion: workflow.version,
        executionId: `exec-${workflowId}-${Date.now()}`,
        nodeId: alert.nodeId,
        deviceId: alert.deviceId,
        severity: alert.severity,
        title: alert.title,
        condition: alert.condition,
        observedValue: alert.observedValue,
        threshold: alert.threshold,
        cooldownSeconds: workflow.graph.settings?.cooldownSeconds ?? 60,
      });
    });

    // Hook node outputs to live overlay broadcaster
    runtime.onNodeOutput((deviceId, portId, msg) => {
      if (this.liveOverlayBroadcaster) {
        this.liveOverlayBroadcaster({
          type: 'NODE_LIVE_OUTPUT',
          workflowId,
          deviceId,
          nodeId: msg.deviceId, // source node
          portId,
          value: msg.value,
          timestamp: msg.timestamp,
        });
      }
    });

    // Subscribe runtime to telemetryBus
    const unsubscribe = telemetryBus.subscribe((record: IngestedTelemetryRecord) => {
      if (record.tenantId === tenantId) {
        runtime.processTelemetry(record);
      }
    });

    this.activeRuntimes.set(workflowId, runtime);
    this.busUnsubscribers.set(workflowId, unsubscribe);

    // Update database status
    const updated = await WorkflowService.updateWorkflow(tenantId, workflowId, {
      status: 'active',
    });

    return updated!;
  }

  static async stopWorkflow(tenantId: string, workflowId: string): Promise<void> {
    const runtime = this.activeRuntimes.get(workflowId);
    if (runtime) {
      runtime.stop();
      this.activeRuntimes.delete(workflowId);
    }

    const unsub = this.busUnsubscribers.get(workflowId);
    if (unsub) {
      unsub();
      this.busUnsubscribers.delete(workflowId);
    }

    await WorkflowService.updateWorkflow(tenantId, workflowId, {
      status: 'stopped',
    });
  }

  static getRuntime(workflowId: string): WorkflowRuntime | undefined {
    return this.activeRuntimes.get(workflowId);
  }

  static isWorkflowActive(workflowId: string): boolean {
    return this.activeRuntimes.has(workflowId);
  }
}
