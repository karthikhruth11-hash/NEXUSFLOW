import { IOperator, EngineMessage, OperatorOutput, OperatorContext } from './types.js';
import { ThresholdConditionConfig } from '../registry/nodes.js';

export class ThresholdConditionOperator implements IOperator {
  readonly id: string;
  readonly type = 'threshold-condition';
  private config: ThresholdConditionConfig;
  // Per-device breach state tracking for hysteresis
  private deviceBreached = new Map<string, boolean>();

  constructor(context: OperatorContext, config: ThresholdConditionConfig) {
    this.id = context.nodeId;
    this.config = config;
  }

  process(_inputPort: string, message: EngineMessage<number>): OperatorOutput[] {
    const val = Number(message.value);
    if (isNaN(val)) return [];

    const currentlyBreached = this.deviceBreached.get(message.deviceId) ?? false;
    let nextBreachState = currentlyBreached;

    const { operator, threshold, hysteresis } = this.config;

    if (!currentlyBreached) {
      // Not in breach: test against primary threshold
      switch (operator) {
        case '>':
          nextBreachState = val > threshold;
          break;
        case '>=':
          nextBreachState = val >= threshold;
          break;
        case '<':
          nextBreachState = val < threshold;
          break;
        case '<=':
          nextBreachState = val <= threshold;
          break;
        case '==':
          nextBreachState = val === threshold;
          break;
        case '!=':
          nextBreachState = val !== threshold;
          break;
      }
    } else {
      // Currently in breach: test if cleared via hysteresis
      if (hysteresis !== undefined) {
        if (operator === '>' || operator === '>=') {
          // Clears only when value drops below hysteresis clear threshold
          if (val < hysteresis) {
            nextBreachState = false;
          } else {
            nextBreachState = true;
          }
        } else if (operator === '<' || operator === '<=') {
          // Clears only when value rises above hysteresis clear threshold
          if (val > hysteresis) {
            nextBreachState = false;
          } else {
            nextBreachState = true;
          }
        } else {
          // Operator == or != with hysteresis
          nextBreachState = Math.abs(val - threshold) > hysteresis;
        }
      } else {
        // No hysteresis specified: test primary condition
        switch (operator) {
          case '>':
            nextBreachState = val > threshold;
            break;
          case '>=':
            nextBreachState = val >= threshold;
            break;
          case '<':
            nextBreachState = val < threshold;
            break;
          case '<=':
            nextBreachState = val <= threshold;
            break;
          case '==':
            nextBreachState = val === threshold;
            break;
          case '!=':
            nextBreachState = val !== threshold;
            break;
        }
      }
    }

    this.deviceBreached.set(message.deviceId, nextBreachState);

    return [
      {
        portId: 'output',
        message: {
          deviceId: message.deviceId,
          timestamp: message.timestamp,
          eventTimeMs: message.eventTimeMs,
          value: nextBreachState,
          metadata: {
            ...message.metadata,
            observedValue: val,
            threshold,
            hysteresis,
            operator,
          },
        },
      },
    ];
  }

  isDeviceBreached(deviceId: string): boolean {
    return this.deviceBreached.get(deviceId) ?? false;
  }

  reset(): void {
    this.deviceBreached.clear();
  }
}
