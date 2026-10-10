import { IOperator, EngineMessage, OperatorOutput, OperatorContext } from './types.js';
import { WindowStatsConfig } from '../registry/nodes.js';

interface StatSample {
  value: number;
  eventTimeMs: number;
}

export class WindowStatsOperator implements IOperator {
  readonly id: string;
  readonly type = 'window-stats';
  private config: WindowStatsConfig;
  private deviceWindows = new Map<string, StatSample[]>();

  constructor(context: OperatorContext, config: WindowStatsConfig) {
    this.id = context.nodeId;
    this.config = config;
  }

  process(_inputPort: string, message: EngineMessage<number>): OperatorOutput[] {
    const numValue = Number(message.value);
    if (isNaN(numValue)) return [];

    let window = this.deviceWindows.get(message.deviceId);
    if (!window) {
      window = [];
      this.deviceWindows.set(message.deviceId, window);
    }

    window.push({ value: numValue, eventTimeMs: message.eventTimeMs });

    // Prune window
    if (this.config.unit === 'count') {
      while (window.length > this.config.window) {
        window.shift();
      }
    } else {
      const cutoff = message.eventTimeMs - this.config.window * 1000;
      while (window.length > 0 && window[0].eventTimeMs < cutoff) {
        window.shift();
      }
    }

    let result = numValue;
    if (this.config.stat === 'min') {
      result = Math.min(...window.map((s) => s.value));
    } else if (this.config.stat === 'max') {
      result = Math.max(...window.map((s) => s.value));
    } else if (this.config.stat === 'rate_of_change') {
      if (window.length >= 2) {
        const first = window[0];
        const last = window[window.length - 1];
        const deltaSec = Math.max(0.001, (last.eventTimeMs - first.eventTimeMs) / 1000);
        result = Math.round(((last.value - first.value) / deltaSec) * 1000) / 1000;
      } else {
        result = 0;
      }
    }

    return [
      {
        portId: 'output',
        message: {
          deviceId: message.deviceId,
          timestamp: message.timestamp,
          eventTimeMs: message.eventTimeMs,
          value: result,
          metadata: {
            ...message.metadata,
            stat: this.config.stat,
          },
        },
      },
    ];
  }

  reset(): void {
    this.deviceWindows.clear();
  }
}
