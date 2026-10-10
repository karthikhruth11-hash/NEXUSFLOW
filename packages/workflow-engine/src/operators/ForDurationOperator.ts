import { IOperator, EngineMessage, OperatorOutput, OperatorContext } from './types.js';
import { ForDurationConfig } from '../registry/nodes.js';

interface ForDurationState {
  firstTrueTimeMs: number | null;
  isFiring: boolean;
}

export class ForDurationOperator implements IOperator {
  readonly id: string;
  readonly type = 'for-duration';
  private config: ForDurationConfig;
  private deviceStates = new Map<string, ForDurationState>();

  constructor(context: OperatorContext, config: ForDurationConfig) {
    this.id = context.nodeId;
    this.config = config;
  }

  process(_inputPort: string, message: EngineMessage<boolean>): OperatorOutput[] {
    const isConditionTrue = Boolean(message.value);
    const requiredDurationMs = this.config.durationSeconds * 1000;

    let state = this.deviceStates.get(message.deviceId);
    if (!state) {
      state = { firstTrueTimeMs: null, isFiring: false };
      this.deviceStates.set(message.deviceId, state);
    }

    let outputValue = false;

    if (isConditionTrue) {
      if (state.firstTrueTimeMs === null) {
        state.firstTrueTimeMs = message.eventTimeMs;
      }
      const elapsedMs = message.eventTimeMs - state.firstTrueTimeMs;
      if (elapsedMs >= requiredDurationMs) {
        state.isFiring = true;
        outputValue = true;
      } else {
        outputValue = false;
      }
    } else {
      // Condition cleared: reset debounce timer
      state.firstTrueTimeMs = null;
      state.isFiring = false;
      outputValue = false;
    }

    return [
      {
        portId: 'output',
        message: {
          deviceId: message.deviceId,
          timestamp: message.timestamp,
          eventTimeMs: message.eventTimeMs,
          value: outputValue,
          metadata: {
            ...message.metadata,
            heldDurationMs: state.firstTrueTimeMs ? message.eventTimeMs - state.firstTrueTimeMs : 0,
            requiredDurationMs,
          },
        },
      },
    ];
  }

  reset(): void {
    this.deviceStates.clear();
  }
}
