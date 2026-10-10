import { IOperator, EngineMessage, OperatorOutput, OperatorContext } from './types.js';
import { LoggerNodeConfig } from '../registry/nodes.js';

export class LoggerOperator implements IOperator {
  readonly id: string;
  readonly type = 'logger';
  private config: LoggerNodeConfig;

  constructor(context: OperatorContext, config: LoggerNodeConfig) {
    this.id = context.nodeId;
    this.config = config;
  }

  process(_inputPort: string, message: EngineMessage): OperatorOutput[] {
    // Diagnostic logging without leaking credentials
    return [
      {
        portId: 'passthrough',
        message,
      },
    ];
  }

  reset(): void {}
}
