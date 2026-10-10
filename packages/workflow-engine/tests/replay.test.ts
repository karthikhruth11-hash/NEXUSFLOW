import { describe, it, expect } from 'vitest';
import { DeterministicReplayEngine } from '../src/replay/index.js';
import { WorkflowDefinition, TelemetryPayload } from '@nexusflow/shared';

describe('Deterministic Replay & Backtest Engine', () => {
  const mvpWorkflow: WorkflowDefinition = {
    schemaVersion: '1.0.0',
    nodes: [
      {
        id: 'node-sensor',
        type: 'sensor-input',
        position: { x: 50, y: 100 },
        config: { deviceId: 'turbine-01', measurement: 'temperature' },
      },
      {
        id: 'node-avg',
        type: 'moving-average',
        position: { x: 250, y: 100 },
        config: { mode: 'count', size: 5, minSamples: 3 },
      },
      {
        id: 'node-thresh',
        type: 'threshold-condition',
        position: { x: 450, y: 100 },
        config: { operator: '>', threshold: 80.0, hysteresis: 75.0 },
      },
      {
        id: 'node-alert',
        type: 'dashboard-alert',
        position: { x: 650, y: 100 },
        config: { severity: 'warning', title: 'Turbine Overheat Alert', cooldownSeconds: 60 },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-sensor', sourcePort: 'value', target: 'node-avg', targetPort: 'input' },
      { id: 'e2', source: 'node-avg', sourcePort: 'output', target: 'node-thresh', targetPort: 'input' },
      { id: 'e3', source: 'node-thresh', sourcePort: 'output', target: 'node-alert', targetPort: 'trigger' },
    ],
    settings: { cooldownSeconds: 60, maxLatenessSeconds: 60, deviceIds: ['turbine-01'] },
  };

  it('runs deterministic replay on normal telemetry with zero alerts', () => {
    const normalTelemetry: TelemetryPayload[] = [
      {
        deviceId: 'turbine-01',
        timestamp: '2026-10-10T10:00:01.000Z',
        measurements: { temperature: { value: 70.0 } },
      },
      {
        deviceId: 'turbine-01',
        timestamp: '2026-10-10T10:00:02.000Z',
        measurements: { temperature: { value: 71.5 } },
      },
      {
        deviceId: 'turbine-01',
        timestamp: '2026-10-10T10:00:03.000Z',
        measurements: { temperature: { value: 69.8 } },
      },
      {
        deviceId: 'turbine-01',
        timestamp: '2026-10-10T10:00:04.000Z',
        measurements: { temperature: { value: 72.0 } },
      },
      {
        deviceId: 'turbine-01',
        timestamp: '2026-10-10T10:00:05.000Z',
        measurements: { temperature: { value: 70.4 } },
      },
    ];

    const result = DeterministicReplayEngine.run('wf-mvp', mvpWorkflow, normalTelemetry);
    expect(result.totalEventsProcessed).toBe(5);
    expect(result.totalAlertsGenerated).toBe(0);
    expect(result.alerts).toEqual([]);
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('detects sustained breach and generates alerts during historical replay', () => {
    const breachTelemetry: TelemetryPayload[] = [
      // 3 normal readings
      { deviceId: 'turbine-01', timestamp: '2026-10-10T10:00:01.000Z', measurements: { temperature: { value: 70.0 } } },
      { deviceId: 'turbine-01', timestamp: '2026-10-10T10:00:02.000Z', measurements: { temperature: { value: 71.0 } } },
      { deviceId: 'turbine-01', timestamp: '2026-10-10T10:00:03.000Z', measurements: { temperature: { value: 72.0 } } },
      // Temperature spikes
      { deviceId: 'turbine-01', timestamp: '2026-10-10T10:00:04.000Z', measurements: { temperature: { value: 88.0 } } },
      { deviceId: 'turbine-01', timestamp: '2026-10-10T10:00:05.000Z', measurements: { temperature: { value: 92.0 } } },
      { deviceId: 'turbine-01', timestamp: '2026-10-10T10:00:06.000Z', measurements: { temperature: { value: 95.0 } } },
    ];

    const result = DeterministicReplayEngine.run('wf-mvp', mvpWorkflow, breachTelemetry);
    expect(result.totalEventsProcessed).toBe(6);
    expect(result.totalAlertsGenerated).toBe(1);
    expect(result.alerts[0].deviceId).toBe('turbine-01');
    expect(result.alerts[0].title).toBe('Turbine Overheat Alert');
    expect(result.alerts[0].observedValue).toBeGreaterThan(80.0);
  });
});
