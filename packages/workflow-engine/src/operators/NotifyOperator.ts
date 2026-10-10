import { IOperator, EngineMessage, OperatorOutput, OperatorContext } from './types.js';
import { NotifyConfig } from '../registry/nodes.js';

export interface NotificationRecord {
  channel: string;
  recipients: string[];
  message: string;
  timestamp: string;
}

export class NotifyOperator implements IOperator {
  readonly id: string;
  readonly type = 'notify';
  private config: NotifyConfig;
  private deliveries: NotificationRecord[] = [];

  constructor(context: OperatorContext, config: NotifyConfig) {
    this.id = context.nodeId;
    this.config = config;
  }

  process(_inputPort: string, message: EngineMessage): OperatorOutput[] {
    const record: NotificationRecord = {
      channel: this.config.channel,
      recipients: this.config.recipients,
      message: this.config.template,
      timestamp: message.timestamp,
    };
    this.deliveries.push(record);
    return [];
  }

  getDeliveries(): NotificationRecord[] {
    return this.deliveries;
  }

  reset(): void {
    this.deliveries = [];
  }
}
