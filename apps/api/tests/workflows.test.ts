import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDb, disconnectDb } from '../src/lib/db.js';
import { WorkflowDefinition } from '@nexusflow/shared';

describe('Workflows CRUD, Validation & Versioning API', () => {
  const app = createApp();

  const validGraph: WorkflowDefinition = {
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
    ],
    edges: [
      { id: 'e1', source: 'node-sensor', sourcePort: 'value', target: 'node-avg', targetPort: 'input' },
      { id: 'e2', source: 'node-avg', sourcePort: 'output', target: 'node-thresh', targetPort: 'input' },
      { id: 'e3', source: 'node-thresh', sourcePort: 'output', target: 'node-alert', targetPort: 'trigger' },
    ],
    settings: { cooldownSeconds: 60, maxLatenessSeconds: 60, deviceIds: ['turbine-01'] },
  };

  const invalidGraph: WorkflowDefinition = {
    schemaVersion: '1.0.0',
    nodes: [
      {
        id: 'node-sensor',
        type: 'sensor-input',
        position: { x: 50, y: 100 },
        config: { deviceId: 'turbine-01', measurement: 'temperature' },
      },
      {
        id: 'node-alert',
        type: 'dashboard-alert',
        position: { x: 250, y: 100 },
        config: { severity: 'warning', title: 'Alert', cooldownSeconds: 60 },
      },
    ],
    edges: [
      // Incompatible port types: number output to boolean input
      { id: 'e1', source: 'node-sensor', sourcePort: 'value', target: 'node-alert', targetPort: 'trigger' },
    ],
    settings: { cooldownSeconds: 60, maxLatenessSeconds: 60, deviceIds: ['turbine-01'] },
  };

  beforeAll(async () => {
    await connectDb();
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('POST /api/workflows/validate returns validation results for valid graph', async () => {
    const res = await request(app).post('/api/workflows/validate').send(validGraph);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.valid).toBe(true);
    expect(res.body.data.issues).toEqual([]);
  });

  it('POST /api/workflows/validate returns structured issues for invalid graph', async () => {
    const res = await request(app).post('/api/workflows/validate').send(invalidGraph);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.valid).toBe(false);
    expect(res.body.data.issues.length).toBeGreaterThan(0);
    expect(res.body.data.issues[0].code).toBe('INCOMPATIBLE_PORT_TYPES');
    expect(res.body.data.issues[0].fixHint).toBeDefined();
  });

  it('POST /api/workflows creates a draft workflow', async () => {
    const res = await request(app)
      .post('/api/workflows')
      .send({
        id: 'wf-turbine-monitor',
        tenantId: 'factory-1',
        name: 'Turbine Temperature Monitor',
        description: 'Monitors turbine generator and alerts when 5-point avg > 80C',
        graph: validGraph,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('wf-turbine-monitor');
    expect(res.body.data.version).toBe(1);
    expect(res.body.data.status).toBe('draft');
  });

  it('GET /api/workflows lists workflows for tenant', async () => {
    const res = await request(app).get('/api/workflows').query({ tenantId: 'factory-1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((w: any) => w.id === 'wf-turbine-monitor')).toBe(true);
  });

  it('GET /api/workflows/:id retrieves single workflow', async () => {
    const res = await request(app)
      .get('/api/workflows/wf-turbine-monitor')
      .query({ tenantId: 'factory-1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('wf-turbine-monitor');
  });

  it('PUT /api/workflows/:id updates workflow metadata or graph', async () => {
    const res = await request(app)
      .put('/api/workflows/wf-turbine-monitor')
      .query({ tenantId: 'factory-1' })
      .send({
        name: 'Turbine Temperature & Vibration Monitor',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Turbine Temperature & Vibration Monitor');
  });

  it('POST /api/workflows/:id/publish blocks publishing if graph has validation errors', async () => {
    // Update workflow with invalid graph
    await request(app)
      .put('/api/workflows/wf-turbine-monitor')
      .query({ tenantId: 'factory-1' })
      .send({ graph: invalidGraph });

    const res = await request(app)
      .post('/api/workflows/wf-turbine-monitor/publish')
      .query({ tenantId: 'factory-1' })
      .send({
        publishedBy: 'chief-engineer',
        changeSummary: 'Attempt invalid publish',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('WORKFLOW_VALIDATION_FAILED');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('POST /api/workflows/:id/publish creates immutable version and increments version on valid graph', async () => {
    // Restore valid graph
    await request(app)
      .put('/api/workflows/wf-turbine-monitor')
      .query({ tenantId: 'factory-1' })
      .send({ graph: validGraph });

    const res = await request(app)
      .post('/api/workflows/wf-turbine-monitor/publish')
      .query({ tenantId: 'factory-1' })
      .send({
        publishedBy: 'chief-engineer',
        changeSummary: 'Initial verified release v2',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.workflow.version).toBe(2);
    expect(res.body.data.workflow.status).toBe('active');
    expect(res.body.data.publishedVersion.version).toBe(2);
    expect(res.body.data.publishedVersion.publishedBy).toBe('chief-engineer');
  });

  it('GET /api/workflows/:id/versions lists immutable version snapshots', async () => {
    const res = await request(app)
      .get('/api/workflows/wf-turbine-monitor/versions')
      .query({ tenantId: 'factory-1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].version).toBe(2);
  });

  it('GET /api/workflows/:id/versions/:version returns exact historical version', async () => {
    const res = await request(app)
      .get('/api/workflows/wf-turbine-monitor/versions/2')
      .query({ tenantId: 'factory-1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.version).toBe(2);
    expect(res.body.data.workflowId).toBe('wf-turbine-monitor');
    expect(res.body.data.graph.nodes.length).toBe(4);
  });

  it('POST /api/workflows/:id/replay runs backtest on historical telemetry without side-effects', async () => {
    // 1. Ingest historical readings into MongoDB
    const now = Date.now();
    const historyReadings = [
      {
        deviceId: 'turbine-01',
        timestamp: new Date(now - 50000).toISOString(),
        measurements: { temperature: { value: 70.0 } },
      },
      {
        deviceId: 'turbine-01',
        timestamp: new Date(now - 40000).toISOString(),
        measurements: { temperature: { value: 72.0 } },
      },
      {
        deviceId: 'turbine-01',
        timestamp: new Date(now - 30000).toISOString(),
        measurements: { temperature: { value: 88.0 } },
      },
      {
        deviceId: 'turbine-01',
        timestamp: new Date(now - 20000).toISOString(),
        measurements: { temperature: { value: 92.0 } },
      },
      {
        deviceId: 'turbine-01',
        timestamp: new Date(now - 10000).toISOString(),
        measurements: { temperature: { value: 95.0 } },
      },
    ];

    const db = (await import('../src/lib/db.js')).getDb();
    await db.collection('telemetry').insertMany(
      historyReadings.map((r) => ({
        timestamp: new Date(r.timestamp),
        meta: { tenantId: 'factory-1', deviceId: r.deviceId },
        measurements: r.measurements,
        ingestTimestamp: new Date().toISOString(),
      }))
    );

    // 2. Call replay endpoint
    const res = await request(app)
      .post('/api/workflows/wf-turbine-monitor/replay')
      .query({ tenantId: 'factory-1' })
      .send({ deviceId: 'turbine-01' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalEventsProcessed).toBeGreaterThanOrEqual(5);
    expect(res.body.data.totalAlertsGenerated).toBeGreaterThanOrEqual(1);
    expect(res.body.data.alerts[0].deviceId).toBe('turbine-01');
    expect(res.body.data.alerts[0].title).toBe('Turbine Overheat');
  });
});
