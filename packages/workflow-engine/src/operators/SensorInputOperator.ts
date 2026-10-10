import { IOperator, EngineMessage, OperatorOutput, OperatorContext } from './types.js';
import { SensorInputConfig } from '../registry/nodes.js';

export class SensorInputOperator implements IOperator {
  readonly id: string;
  readonly type = 'sensor-input';
  private config: SensorInputConfig;

  constructor(context: OperatorContext, config: SensorInputConfig) {
    this.id = context.nodeId;
    this.config = config;
  }

  process(_inputPort: string, message: EngineMessage): OperatorOutput[] {
    // Only accept telemetry matching the configured deviceId (or wildcard/group)
    if (this.config.deviceId && message.deviceId !== this.config.deviceId) {
      return [];
    }

    const payload = message.rawEvent as {
      measurements?: Record<string, { value: number; unit?: string }>;
    };

    if (!payload || !payload.measurements) {
      return [];
    }

    const metric = payload.measurements[this.config.measurement];
    if (!metric || typeof metric.value !== 'number') {
      return [];
    }

    return [
      {
        portId: 'value',
        message: {
          deviceId: message.deviceId,
          timestamp: message.timestamp,
          eventTimeMs: message.eventTimeMs,
          value: metric.value,
          metadata: { unit: metric.unit || this.config.unit },
        },
      },
      {
        portId: 'event',
        message: {
          deviceId: message.deviceId,
          timestamp: message.timestamp,
          eventTimeMs: message.eventTimeMs,
          value: payload,
        },
      },
    ];
  }

  reset(): void {
    // Stateless
  }
}
