export interface EngineMessage<T = unknown> {
  deviceId: string;
  timestamp: string; // ISO-8601 event time
  eventTimeMs: number;
  value: T;
  rawEvent?: unknown;
  metadata?: Record<string, unknown>;
}

export interface OperatorContext {
  workflowId: string;
  nodeId: string;
  executionId?: string;
}

export interface OperatorOutput {
  portId: string;
  message: EngineMessage;
}

export interface IOperator {
  readonly id: string;
  readonly type: string;
  process(inputPort: string, message: EngineMessage): OperatorOutput[];
  reset(): void;
}
