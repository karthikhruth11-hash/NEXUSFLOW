import { IOperator, EngineMessage, OperatorOutput, OperatorContext } from './types.js';
import { AbsenceHeartbeatConfig } from '../registry/nodes.js';

export class AbsenceHeartbeatOperator implements IOperator {
  readonly id: string;
  readonly type = 'absence-heartbeat';
  private config: AbsenceHeartbeatConfig;
  private lastSeenMap = new Map<string, number>();

  constructor(context: OperatorContext, config: AbsenceHeartbeatConfig) {
    this.id = context.nodeId;
    this.config = config;
  }

  process(_inputPort: string, message: EngineMessage): OperatorOutput[] {
    const lastSeen = this.lastSeenMap.get(message.deviceId);
    const timeoutMs = this.config.timeoutSeconds * 1000;

    let isAbsent = false;
    if (lastSeen !== undefined) {
      const gapMs = message.eventTimeMs - lastSeen;
      if (gapMs >= timeoutMs) {
        isAbsent = true;
      }
    }

    this.lastSeenMap.set(message.deviceId, message.eventTimeMs);

    return [
      {
        portId: 'output',
        message: {
          deviceId: message.deviceId,
          timestamp: message.timestamp,
          eventTimeMs: message.eventTimeMs,
          value: isAbsent,
          metadata: {
            ...message.metadata,
            timeoutSeconds: this.config.timeoutSeconds,
          },
        },
      },
    ];
  }

  // Active check (e.g., invoked on clock tick for heartbeat monitoring)
  checkAbsence(deviceId: string, currentTimeMs: number): boolean {
    const lastSeen = this.lastSeenMap.get(deviceId);
    if (lastSeen === undefined) return false;
    return currentTimeMs - lastSeen >= this.config.timeoutSeconds * 1000;
  }

  reset(): void {
    this.lastSeenMap.clear();
  }
}
