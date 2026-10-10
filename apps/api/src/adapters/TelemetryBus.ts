import { IngestedTelemetryRecord } from '@nexusflow/shared';

export type TelemetryListener = (telemetry: IngestedTelemetryRecord) => void;

export interface ITelemetryBus {
  publish(telemetry: IngestedTelemetryRecord): void;
  subscribe(listener: TelemetryListener): () => void;
  getBufferDepth(): number;
  getDroppedCount(): number;
}

export class InMemoryTelemetryBus implements ITelemetryBus {
  private listeners: Set<TelemetryListener> = new Set();
  private buffer: IngestedTelemetryRecord[] = [];
  private maxBufferSize: number;
  private droppedCount: number = 0;

  constructor(maxBufferSize: number = 10000) {
    this.maxBufferSize = maxBufferSize;
  }

  publish(telemetry: IngestedTelemetryRecord): void {
    // Backpressure policy: drop-oldest if buffer exceeds max capacity
    if (this.buffer.length >= this.maxBufferSize) {
      this.buffer.shift();
      this.droppedCount++;
    }
    this.buffer.push(telemetry);

    // Notify active subscribers
    for (const listener of this.listeners) {
      try {
        listener(telemetry);
      } catch (err) {
        console.error('Error in TelemetryBus subscriber:', err);
      }
    }
  }

  subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getBufferDepth(): number {
    return this.buffer.length;
  }

  getDroppedCount(): number {
    return this.droppedCount;
  }
}

export const telemetryBus = new InMemoryTelemetryBus();
