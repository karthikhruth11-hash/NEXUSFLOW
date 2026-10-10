import { IOperator, EngineMessage, OperatorOutput, OperatorContext } from './types.js';
import { MovingAverageConfig } from '../registry/nodes.js';

interface WindowSample {
  value: number;
  eventTimeMs: number;
}

export class MovingAverageOperator implements IOperator {
  readonly id: string;
  readonly type = 'moving-average';
  private config: MovingAverageConfig;
  // Per-device isolated window buffers: deviceId -> samples
  private deviceWindows = new Map<string, WindowSample[]>();

  constructor(context: OperatorContext, config: MovingAverageConfig) {
    this.id = context.nodeId;
    this.config = config;
  }

  process(_inputPort: string, message: EngineMessage<number>): OperatorOutput[] {
    const numValue = Number(message.value);
    if (isNaN(numValue)) {
      return [];
    }

    let window = this.deviceWindows.get(message.deviceId);
    if (!window) {
      window = [];
      this.deviceWindows.set(message.deviceId, window);
    }

    // Add current sample
    window.push({
      value: numValue,
      eventTimeMs: message.eventTimeMs,
    });

    // Prune window based on mode
    if (this.config.mode === 'count') {
      while (window.length > this.config.size) {
        window.shift();
      }
    } else if (this.config.mode === 'duration') {
      const windowDurationMs = this.config.size * 1000;
      const cutoffTime = message.eventTimeMs - windowDurationMs;
      // Remove samples older than duration cutoff
      while (window.length > 0 && window[0].eventTimeMs < cutoffTime) {
        window.shift();
      }
    }

    // Check minSamples threshold
    const minSamples = this.config.minSamples ?? 1;
    if (window.length < minSamples) {
      return [];
    }

    // Calculate arithmetic mean
    const sum = window.reduce((acc, curr) => acc + curr.value, 0);
    const average = Math.round((sum / window.length) * 1000) / 1000;

    return [
      {
        portId: 'output',
        message: {
          deviceId: message.deviceId,
          timestamp: message.timestamp,
          eventTimeMs: message.eventTimeMs,
          value: average,
          metadata: {
            ...message.metadata,
            samplesCount: window.length,
          },
        },
      },
    ];
  }

  // Diagnostic helper to inspect isolated device window depth
  getWindowSamples(deviceId: string): number[] {
    return (this.deviceWindows.get(deviceId) || []).map((s) => s.value);
  }

  reset(): void {
    this.deviceWindows.clear();
  }
}
