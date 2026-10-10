import { WorkflowDefinition, IngestedTelemetryRecord } from '@nexusflow/shared';
import { GraphCompiler, ExecutionPlan } from '../compiler/index.js';
import { EngineMessage } from '../operators/types.js';
import { AlertEventPayload } from '../operators/DashboardAlertOperator.js';

export type RuntimeStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'error';

export interface RuntimeMetrics {
  eventsProcessed: number;
  alertsGenerated: number;
  errorsCount: number;
  lastEventTimestamp?: string;
  uptimeSeconds: number;
}

export type AlertCallback = (alert: AlertEventPayload) => void;
export type NodeOutputCallback = (nodeId: string, portId: string, message: EngineMessage) => void;

export class WorkflowRuntime {
  readonly workflowId: string;
  private currentDefinition: WorkflowDefinition;
  private plan: ExecutionPlan | null = null;
  private status: RuntimeStatus = 'idle';
  private alertListeners: Set<AlertCallback> = new Set();
  private outputListeners: Set<NodeOutputCallback> = new Set();
  private eventsProcessed = 0;
  private alertsGenerated = 0;
  private errorsCount = 0;
  private maxConsecutiveErrors = 10;
  private startedAt: number | null = null;

  constructor(workflowId: string, definition: WorkflowDefinition) {
    this.workflowId = workflowId;
    this.currentDefinition = definition;
    this.compile();
  }

  private compile(): void {
    this.plan = GraphCompiler.compile(this.workflowId, this.currentDefinition);
  }

  start(): void {
    if (this.status === 'running') return;
    this.status = 'running';
    this.startedAt = Date.now();
  }

  stop(): void {
    this.status = 'stopped';
    if (this.plan) {
      this.plan.reset();
    }
  }

  pause(): void {
    if (this.status === 'running') {
      this.status = 'paused';
    }
  }

  resume(): void {
    if (this.status === 'paused') {
      this.status = 'running';
    }
  }

  getStatus(): RuntimeStatus {
    return this.status;
  }

  getMetrics(): RuntimeMetrics {
    const uptimeSeconds = this.startedAt && this.status === 'running'
      ? Math.floor((Date.now() - this.startedAt) / 1000)
      : 0;

    return {
      eventsProcessed: this.eventsProcessed,
      alertsGenerated: this.alertsGenerated,
      errorsCount: this.errorsCount,
      uptimeSeconds,
    };
  }

  onAlert(listener: AlertCallback): () => void {
    this.alertListeners.add(listener);
    return () => this.alertListeners.delete(listener);
  }

  onNodeOutput(listener: NodeOutputCallback): () => void {
    this.outputListeners.add(listener);
    return () => this.outputListeners.delete(listener);
  }

  // Graceful hot-swap of workflow version
  hotSwap(newDefinition: WorkflowDefinition, carryOverState = false): void {
    const newPlan = GraphCompiler.compile(this.workflowId, newDefinition);
    if (!carryOverState && this.plan) {
      this.plan.reset();
    }
    this.currentDefinition = newDefinition;
    this.plan = newPlan;
  }

  // Processes an incoming ingested telemetry record
  processTelemetry(record: IngestedTelemetryRecord): void {
    if (this.status !== 'running' || !this.plan) {
      return;
    }

    try {
      const eventTimeMs = new Date(record.timestamp).getTime();
      const message: EngineMessage = {
        deviceId: record.deviceId,
        timestamp: record.timestamp,
        eventTimeMs,
        value: record,
        rawEvent: record,
      };

      const { alerts, allOutputs } = this.plan.execute(message);
      this.eventsProcessed++;

      // Dispatch node live output overlays
      for (const out of allOutputs) {
        for (const listener of this.outputListeners) {
          listener(out.message.deviceId, out.portId, out.message);
        }
      }

      // Dispatch alert callbacks
      if (alerts.length > 0) {
        this.alertsGenerated += alerts.length;
        for (const alert of alerts) {
          for (const listener of this.alertListeners) {
            try {
              listener(alert);
            } catch (err) {
              console.error('Error in alert listener:', err);
            }
          }
        }
      }
    } catch (err) {
      this.errorsCount++;
      console.error(`Workflow ${this.workflowId} runtime error:`, err);
      // Circuit breaker: trip if too many consecutive errors
      if (this.errorsCount >= this.maxConsecutiveErrors) {
        this.status = 'error';
        console.error(`Circuit breaker tripped for workflow ${this.workflowId}. Execution halted.`);
      }
    }
  }
}
