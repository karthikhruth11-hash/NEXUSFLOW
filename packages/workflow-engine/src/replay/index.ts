import { WorkflowDefinition, TelemetryPayload } from '@nexusflow/shared';
import { GraphCompiler, ExecutionPlan } from '../compiler/index.js';
import { EngineMessage } from '../operators/types.js';
import { AlertEventPayload } from '../operators/DashboardAlertOperator.js';

export interface ReplayResult {
  totalEventsProcessed: number;
  totalAlertsGenerated: number;
  alerts: AlertEventPayload[];
  executionTimeMs: number;
}

export class DeterministicReplayEngine {
  static run(
    workflowId: string,
    workflow: WorkflowDefinition,
    telemetryHistory: TelemetryPayload[]
  ): ReplayResult {
    const startTime = performance.now();
    const plan = GraphCompiler.compile(workflowId, workflow);

    const allAlerts: AlertEventPayload[] = [];

    for (const record of telemetryHistory) {
      const eventTimeMs = new Date(record.timestamp).getTime();
      const message: EngineMessage = {
        deviceId: record.deviceId,
        timestamp: record.timestamp,
        eventTimeMs,
        value: record,
        rawEvent: record,
      };

      const step = plan.execute(message);
      if (step.alerts.length > 0) {
        allAlerts.push(...step.alerts);
      }
    }

    const executionTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

    return {
      totalEventsProcessed: telemetryHistory.length,
      totalAlertsGenerated: allAlerts.length,
      alerts: allAlerts,
      executionTimeMs,
    };
  }
}
