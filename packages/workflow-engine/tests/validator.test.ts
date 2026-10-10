import { describe, it, expect } from 'vitest';
import { GraphValidator, defaultValidator } from '../src/validator/index.js';
import { registry } from '../src/registry/index.js';
import { WorkflowDefinition } from '@nexusflow/shared';

describe('Operator Registry', () => {
  it('registers all 10 initial approved node types', () => {
    const nodes = registry.getAllNodes();
    expect(nodes.length).toBe(10);

    const types = nodes.map((n) => n.type);
    expect(types).toContain('sensor-input');
    expect(types).toContain('moving-average');
    expect(types).toContain('window-stats');
    expect(types).toContain('threshold-condition');
    expect(types).toContain('for-duration');
    expect(types).toContain('absence-heartbeat');
    expect(types).toContain('boolean-logic');
    expect(types).toContain('dashboard-alert');
    expect(types).toContain('notify');
    expect(types).toContain('logger');
  });

  it('checks port compatibility accurately', () => {
    expect(registry.arePortsCompatible('number', 'number')).toBe(true);
    expect(registry.arePortsCompatible('boolean', 'boolean')).toBe(true);
    expect(registry.arePortsCompatible('event', 'event')).toBe(true);
    expect(registry.arePortsCompatible('number', 'boolean')).toBe(false);
    expect(registry.arePortsCompatible('boolean', 'event')).toBe(false);
  });
});

describe('GraphValidator Unit Tests', () => {
  const createValidMvpWorkflow = (): WorkflowDefinition => ({
    schemaVersion: '1.0.0',
    nodes: [
      {
        id: 'node-sensor',
        type: 'sensor-input',
        position: { x: 50, y: 100 },
        config: { deviceId: 'turbine-01', measurement: 'temperature', unit: 'celsius' },
      },
      {
        id: 'node-avg',
        type: 'moving-average',
        position: { x: 250, y: 100 },
        config: { mode: 'count', size: 5, minSamples: 1 },
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
      {
        id: 'node-notify',
        type: 'notify',
        position: { x: 850, y: 100 },
        config: { channel: 'mock', recipients: ['admin@plant.com'], template: 'Overheat alert' },
      },
    ],
    edges: [
      { id: 'e1', source: 'node-sensor', sourcePort: 'value', target: 'node-avg', targetPort: 'input' },
      { id: 'e2', source: 'node-avg', sourcePort: 'output', target: 'node-thresh', targetPort: 'input' },
      { id: 'e3', source: 'node-thresh', sourcePort: 'output', target: 'node-alert', targetPort: 'trigger' },
      { id: 'e4', source: 'node-alert', sourcePort: 'alertEvent', target: 'node-notify', targetPort: 'event' },
    ],
    settings: { cooldownSeconds: 60, maxLatenessSeconds: 60, deviceIds: ['turbine-01'] },
  });

  it('validates a completely correct MVP graph', () => {
    const wf = createValidMvpWorkflow();
    const result = defaultValidator.validate(wf);

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('catches GRAPH_EMPTY when nodes array is empty', () => {
    const wf: WorkflowDefinition = {
      schemaVersion: '1.0.0',
      nodes: [],
      edges: [],
      settings: { cooldownSeconds: 60, maxLatenessSeconds: 60, deviceIds: [] },
    };
    const result = defaultValidator.validate(wf);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'GRAPH_EMPTY')).toBe(true);
  });

  it('catches GRAPH_LIMITS_EXCEEDED when node or edge counts exceed limits', () => {
    const validator = new GraphValidator({ maxNodes: 2, maxEdges: 1 });
    const wf = createValidMvpWorkflow();
    const result = validator.validate(wf);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'GRAPH_LIMITS_EXCEEDED')).toBe(true);
  });

  it('catches DUPLICATE_NODE_ID', () => {
    const wf = createValidMvpWorkflow();
    wf.nodes.push({
      id: 'node-sensor', // duplicate ID!
      type: 'sensor-input',
      position: { x: 0, y: 0 },
      config: { deviceId: 'turbine-02', measurement: 'pressure' },
    });
    const result = defaultValidator.validate(wf);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'DUPLICATE_NODE_ID')).toBe(true);
  });

  it('catches UNKNOWN_NODE_TYPE and provides allowed fix hint', () => {
    const wf = createValidMvpWorkflow();
    wf.nodes[0].type = 'custom-arbitrary-script';
    const result = defaultValidator.validate(wf);

    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.code === 'UNKNOWN_NODE_TYPE');
    expect(issue).toBeDefined();
    expect(issue?.fixHint).toContain('sensor-input');
  });

  it('catches MISSING_CONFIG when required fields are missing', () => {
    const wf = createValidMvpWorkflow();
    wf.nodes[0].config = {}; // Missing deviceId and measurement
    const result = defaultValidator.validate(wf);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'MISSING_CONFIG')).toBe(true);
  });

  it('catches OUT_OF_RANGE_CONFIG when minSamples exceeds count window size', () => {
    const wf = createValidMvpWorkflow();
    wf.nodes[1].config = { mode: 'count', size: 5, minSamples: 10 }; // 10 > 5
    const result = defaultValidator.validate(wf);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'OUT_OF_RANGE_CONFIG')).toBe(true);
  });

  it('catches OUT_OF_RANGE_CONFIG when hysteresis is invalid for > and < operators', () => {
    // For '>', hysteresis must be LOWER than threshold
    const wf1 = createValidMvpWorkflow();
    wf1.nodes[2].config = { operator: '>', threshold: 80, hysteresis: 85 }; // 85 >= 80 invalid
    const result1 = defaultValidator.validate(wf1);
    expect(result1.valid).toBe(false);
    expect(result1.issues.some((i) => i.code === 'OUT_OF_RANGE_CONFIG')).toBe(true);

    // For '<', hysteresis must be HIGHER than threshold
    const wf2 = createValidMvpWorkflow();
    wf2.nodes[2].config = { operator: '<', threshold: 20, hysteresis: 15 }; // 15 <= 20 invalid
    const result2 = defaultValidator.validate(wf2);
    expect(result2.valid).toBe(false);
    expect(result2.issues.some((i) => i.code === 'OUT_OF_RANGE_CONFIG')).toBe(true);
  });

  it('catches WINDOW_SIZE_LIMIT_EXCEEDED when window exceeds bounds', () => {
    const wf = createValidMvpWorkflow();
    wf.nodes[1].config = { mode: 'count', size: 1000, minSamples: 1 };
    const result = defaultValidator.validate(wf, { maxWindowCount: 500 });

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'WINDOW_SIZE_LIMIT_EXCEEDED')).toBe(true);

    wf.nodes[1].config = { mode: 'duration', size: 7200, minSamples: 1 };
    const result2 = defaultValidator.validate(wf, { maxWindowDurationSeconds: 3600 });
    expect(result2.valid).toBe(false);
    expect(result2.issues.some((i) => i.code === 'WINDOW_SIZE_LIMIT_EXCEEDED')).toBe(true);
  });

  it('catches UNAUTHORIZED_DEVICE when sensor references unauthorized deviceId', () => {
    const wf = createValidMvpWorkflow();
    const result = defaultValidator.validate(wf, {
      authorizedDeviceIds: ['authorized-turbine-99'],
    });

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'UNAUTHORIZED_DEVICE')).toBe(true);
  });

  it('catches DANGLING_EDGE for non-existent source and target nodes', () => {
    const wf = createValidMvpWorkflow();
    wf.edges.push({
      id: 'dangling-1',
      source: 'phantom-source',
      sourcePort: 'output',
      target: 'node-avg',
      targetPort: 'input',
    });
    const result1 = defaultValidator.validate(wf);
    expect(result1.issues.some((i) => i.code === 'DANGLING_EDGE')).toBe(true);

    const wf2 = createValidMvpWorkflow();
    wf2.edges.push({
      id: 'dangling-2',
      source: 'node-avg',
      sourcePort: 'output',
      target: 'phantom-target',
      targetPort: 'input',
    });
    const result2 = defaultValidator.validate(wf2);
    expect(result2.issues.some((i) => i.code === 'DANGLING_EDGE')).toBe(true);
  });

  it('catches DANGLING_EDGE for non-existent source or target ports', () => {
    const wf = createValidMvpWorkflow();
    wf.edges[0].sourcePort = 'nonexistent-port';
    const result = defaultValidator.validate(wf);

    expect(result.issues.some((i) => i.code === 'DANGLING_EDGE')).toBe(true);

    const wf2 = createValidMvpWorkflow();
    wf2.edges[0].targetPort = 'nonexistent-input';
    const result2 = defaultValidator.validate(wf2);

    expect(result2.issues.some((i) => i.code === 'DANGLING_EDGE')).toBe(true);
  });

  it('catches INCOMPATIBLE_PORT_TYPES when connecting number to boolean port', () => {
    const wf = createValidMvpWorkflow();
    // Connect sensor value (number) directly to dashboard alert trigger (boolean)
    wf.edges = [
      { id: 'bad-type-edge', source: 'node-sensor', sourcePort: 'value', target: 'node-alert', targetPort: 'trigger' },
    ];
    const result = defaultValidator.validate(wf);

    expect(result.valid).toBe(false);
    const issue = result.issues.find((i) => i.code === 'INCOMPATIBLE_PORT_TYPES');
    expect(issue).toBeDefined();
    expect(issue?.message).toContain("Cannot connect 'number' output");
    expect(issue?.message).toContain("'boolean' input");
  });

  it('catches DUPLICATE_EDGE', () => {
    const wf = createValidMvpWorkflow();
    wf.edges.push({
      id: 'dup-edge',
      source: 'node-sensor',
      sourcePort: 'value',
      target: 'node-avg',
      targetPort: 'input',
    });
    const result = defaultValidator.validate(wf);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'DUPLICATE_EDGE')).toBe(true);
  });

  it('catches CYCLE_DETECTED in circular graph', () => {
    const wf = createValidMvpWorkflow();
    // Add cycle from node-thresh back to node-avg (avg -> thresh -> avg)
    wf.edges.push({
      id: 'cycle-edge',
      source: 'node-thresh',
      sourcePort: 'output',
      target: 'node-avg',
      targetPort: 'input',
    });
    const result = defaultValidator.validate(wf);

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'CYCLE_DETECTED')).toBe(true);
  });

  it('catches ORPHANED_NODE when intermediate node has no incoming edges', () => {
    const wf = createValidMvpWorkflow();
    // Remove edge leading to node-thresh
    wf.edges = wf.edges.filter((e) => e.target !== 'node-thresh');
    const result = defaultValidator.validate(wf);

    expect(result.valid).toBe(false);
    const orphanIssue = result.issues.find((i) => i.code === 'ORPHANED_NODE' && i.nodeId === 'node-thresh');
    expect(orphanIssue).toBeDefined();
  });

  it('validates window-stats, for-duration, absence-heartbeat, boolean-logic, and logger nodes', () => {
    const wf: WorkflowDefinition = {
      schemaVersion: '1.0.0',
      nodes: [
        {
          id: 'sensor',
          type: 'sensor-input',
          position: { x: 0, y: 0 },
          config: { deviceId: 'pump-01', measurement: 'vibration' },
        },
        {
          id: 'stats',
          type: 'window-stats',
          position: { x: 200, y: 0 },
          config: { stat: 'rate_of_change', window: 5, unit: 'count' },
        },
        {
          id: 'absence',
          type: 'absence-heartbeat',
          position: { x: 200, y: 150 },
          config: { timeoutSeconds: 30 },
        },
        {
          id: 'debounce',
          type: 'for-duration',
          position: { x: 400, y: 150 },
          config: { durationSeconds: 5 },
        },
        {
          id: 'bool',
          type: 'boolean-logic',
          position: { x: 600, y: 150 },
          config: { operation: 'OR', alignmentPolicy: 'latest_held', holdDurationSeconds: 10 },
        },
        {
          id: 'logger',
          type: 'logger',
          position: { x: 400, y: 0 },
          config: { level: 'info', redact: true },
        },
      ],
      edges: [
        { id: 'e1', source: 'sensor', sourcePort: 'value', target: 'stats', targetPort: 'input' },
        { id: 'e2', source: 'sensor', sourcePort: 'value', target: 'absence', targetPort: 'input' },
        { id: 'e3', source: 'stats', sourcePort: 'output', target: 'logger', targetPort: 'input_num' },
        { id: 'e4', source: 'absence', sourcePort: 'output', target: 'debounce', targetPort: 'input' },
        { id: 'e5', source: 'debounce', sourcePort: 'output', target: 'bool', targetPort: 'in_a' },
      ],
      settings: { cooldownSeconds: 30, maxLatenessSeconds: 30, deviceIds: ['pump-01'] },
    };

    const result = defaultValidator.validate(wf);
    expect(result.valid).toBe(true);
  });
});
