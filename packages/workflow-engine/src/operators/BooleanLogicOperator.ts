import { IOperator, EngineMessage, OperatorOutput, OperatorContext } from './types.js';
import { BooleanLogicConfig } from '../registry/nodes.js';

interface InputSlot {
  val: boolean;
  timeMs: number;
}

export class BooleanLogicOperator implements IOperator {
  readonly id: string;
  readonly type = 'boolean-logic';
  private config: BooleanLogicConfig;
  private deviceInputs = new Map<string, { a?: InputSlot; b?: InputSlot }>();

  constructor(context: OperatorContext, config: BooleanLogicConfig) {
    this.id = context.nodeId;
    this.config = config;
  }

  process(inputPort: string, message: EngineMessage<boolean>): OperatorOutput[] {
    const boolVal = Boolean(message.value);

    // NOT operation only operates on single input (in_a or any)
    if (this.config.operation === 'NOT') {
      return [
        {
          portId: 'output',
          message: {
            deviceId: message.deviceId,
            timestamp: message.timestamp,
            eventTimeMs: message.eventTimeMs,
            value: !boolVal,
            metadata: message.metadata,
          },
        },
      ];
    }

    let slots = this.deviceInputs.get(message.deviceId);
    if (!slots) {
      slots = {};
      this.deviceInputs.set(message.deviceId, slots);
    }

    if (inputPort === 'in_a') {
      slots.a = { val: boolVal, timeMs: message.eventTimeMs };
    } else if (inputPort === 'in_b') {
      slots.b = { val: boolVal, timeMs: message.eventTimeMs };
    }

    const maxHoldMs = (this.config.holdDurationSeconds ?? 10) * 1000;

    // Check expiration of held slots
    const isAValid = slots.a !== undefined && message.eventTimeMs - slots.a.timeMs <= maxHoldMs;
    const isBValid = slots.b !== undefined && message.eventTimeMs - slots.b.timeMs <= maxHoldMs;

    const valA = isAValid ? slots.a!.val : false;
    const valB = isBValid ? slots.b!.val : false;

    let result = false;
    if (this.config.operation === 'AND') {
      result = isAValid && isBValid && (valA && valB);
    } else if (this.config.operation === 'OR') {
      result = (isAValid && valA) || (isBValid && valB);
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
            operation: this.config.operation,
          },
        },
      },
    ];
  }

  reset(): void {
    this.deviceInputs.clear();
  }
}
