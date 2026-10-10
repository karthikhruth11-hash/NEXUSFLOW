import { describe, it, expect } from 'vitest';
import { WorkflowRuntime } from '../src/runtime/index.js';
import { WorkflowDefinition, IngestedTelemetryRecord } from '@nexusflow/shared';

describe('WorkflowRuntime Lifecycle & Live Streaming', () => {
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
        config: { mode: 'count', size: 3, minSamples: 1 },
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
        config: { severity: 'warning', title: 'Turbine Overheat', cooldownSeconds: 60 },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-sensor', sourcePort: 'value', target: 'node-avg', targetPort: 'input' },
      { id: 'e2', source: 'node-avg', sourcePort: 'output', target: 'node-thresh', targetPort: 'input' },
      { id: 'e3', source: 'node-thresh', sourcePort: 'output', target: 'node-alert', targetPort: 'trigger' },
    ],
    settings: { cooldownSeconds: 60, maxLatenessSeconds: 60, deviceIds: ['turbine-01'] },
  };

  const createRecord = (temp: number, timeMs: number): IngestedTelemetryRecord => ({
    deviceId: 'turbine-01',
    timestamp: new Date(timeMs).toISOString(),
    measurements: { temperature: { value: temp } },
    tenantId: 'factory-1',
    ingestTimestamp: new Date().toISOString(),
  });

  it('controls lifecycle (start, pause, resume, stop) and tracks metrics', () => {
    const runtime = new WorkflowRuntime('wf-test', mvpWorkflow);
    expect(runtime.getStatus()).toBe('idle');

    runtime.start();
    expect(runtime.getStatus()).toBe('running');

    runtime.pause();
    expect(runtime.getStatus()).toBe('paused');

    runtime.resume();
    expect(runtime.getStatus()).toBe('running');

    runtime.stop();
    expect(runtime.getStatus()).toBe('stopped');
  });

  it('processes streaming telemetry and emits alert callback on breach', () => {
    const runtime = new WorkflowRuntime('wf-stream', mvpWorkflow);
    runtime.start();

    const receivedAlerts: any[] = [];
    runtime.onAlert((alert) => {
      receivedAlerts.push(alert);
    });

    // Send normal reading
    runtime.processTelemetry(createRecord(70, 1000));
    expect(receivedAlerts.length).toBe(0);

    // Send breach readings
    runtime.processTelemetry(createRecord(85, 2000));
    runtime.processTelemetry(createRecord(90, 3000));

    expect(receivedAlerts.length).toBe(1);
    expect(receivedAlerts[0].deviceId).toBe('turbine-01');
    expect(receivedAlerts[0].title).toBe('Turbine Overheat');

    const metrics = runtime.getMetrics();
    expect(metrics.eventsProcessed).toBe(3);
    expect(metrics.alertsGenerated).toBe(1);
  });

  it('supports hot-swap of workflow definition without restart', () => {
    const runtime = new WorkflowRuntime('wf-hotswap', mvpWorkflow);
    runtime.start();

    // Hot swap threshold from 80 to 95
    const updatedWorkflow: WorkflowDefinition = JSON.parse(JSON.stringify(mvpWorkflow));
    updatedWorkflow.nodes[2].config = { operator: '>', threshold: 95.0, hysteresis: 90.0 };

    runtime.hotSwap(updatedWorkflow);

    const receivedAlerts: any[] = [];
    runtime.onAlert((alert) => receivedAlerts.push(alert));

    // Send 85 (was breach in old version, now normal in new version)
    runtime.processTelemetry(createRecord(85, 1000));
    expect(receivedAlerts.length).toBe(0);

    // Send 98s to fill 3-sample window: (85+98)/2=91.5, (85+98+98)/3=93.67, (98+98+98)/3=98 > 95
    runtime.processTelemetry(createRecord(98, 2000));
    runtime.processTelemetry(createRecord(98, 3000));
    runtime.processTelemetry(createRecord(98, 4000));
    expect(receivedAlerts.length).toBe(1);
  });
});
