import { describe, it, expect } from 'vitest';
import {
  TelemetryPayloadSchema,
  BatchTelemetryPayloadSchema,
  GraphNodeSchema,
  GraphEdgeSchema,
  AlertStateSchema,
} from '../src/index.js';

describe('Shared Schemas Validation', () => {
  it('validates correct telemetry payload', () => {
    const valid = {
      deviceId: 'turbine-01',
      timestamp: '2026-10-09T12:00:00.000Z',
      measurements: {
        temperature: { value: 82.5, unit: 'celsius' },
      },
    };
    const result = TelemetryPayloadSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects invalid telemetry payload without measurements', () => {
    const invalid = {
      deviceId: 'turbine-01',
      timestamp: '2026-10-09T12:00:00.000Z',
      measurements: {},
    };
    const result = TelemetryPayloadSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('validates batch telemetry payload', () => {
    const batch = {
      readings: [
        {
          deviceId: 'turbine-01',
          timestamp: '2026-10-09T12:00:00.000Z',
          measurements: { temperature: { value: 70.0 } },
        },
      ],
    };
    const result = BatchTelemetryPayloadSchema.safeParse(batch);
    expect(result.success).toBe(true);
  });

  it('validates graph node and edge schemas', () => {
    const node = {
      id: 'node-1',
      type: 'sensor-input',
      position: { x: 100, y: 150 },
      config: { deviceId: 'turbine-01', measurement: 'temperature' },
    };
    expect(GraphNodeSchema.safeParse(node).success).toBe(true);

    const edge = {
      id: 'edge-1',
      source: 'node-1',
      sourcePort: 'output',
      target: 'node-2',
      targetPort: 'input',
    };
    expect(GraphEdgeSchema.safeParse(edge).success).toBe(true);
  });

  it('validates alert states match the 5 state machine states', () => {
    const states = ['OK', 'PENDING', 'FIRING', 'ACKNOWLEDGED', 'RESOLVED'];
    for (const s of states) {
      expect(AlertStateSchema.safeParse(s).success).toBe(true);
    }
    expect(AlertStateSchema.safeParse('UNKNOWN').success).toBe(false);
  });
});
