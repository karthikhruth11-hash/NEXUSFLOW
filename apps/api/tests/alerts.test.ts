import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDb, disconnectDb } from '../src/lib/db.js';
import { AlertService } from '../src/services/AlertService.js';
import { MockNotifier, INotifier } from '@nexusflow/notifiers';
import { WorkflowService } from '../src/services/WorkflowService.js';
import { DeviceService } from '../src/services/DeviceService.js';
import { demoMvpWorkflow } from '../src/scripts/seed.js';

describe('Alert Lifecycle State Machine, Deduplication & Notifiers', () => {
  const app = createApp();
  const mockNotifier = new MockNotifier();

  beforeAll(async () => {
    await connectDb();
    AlertService.setNotifier(mockNotifier);
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('One breach creates exactly one alert in FIRING state and sends one notification', async () => {
    mockNotifier.clear();

    const alert = await AlertService.handleBreachEvent({
      tenantId: 'factory-test',
      workflowId: 'wf-temp',
      workflowVersion: 1,
      executionId: 'exec-1',
      nodeId: 'alert-node-1',
      deviceId: 'turbine-x',
      severity: 'critical',
      title: 'Turbine Overheat Danger',
      condition: '>',
      observedValue: 88.5,
      threshold: 80.0,
      cooldownSeconds: 60,
    });

    expect(alert.state).toBe('FIRING');
    expect(alert.observedValue).toBe(88.5);
    expect(alert.firingAt).toBeDefined();

    // Verify exactly one notification was sent
    const sent = mockNotifier.getSent();
    expect(sent.length).toBe(1);
    expect(sent[0].payload.alertId).toBe(alert.id);
    expect(sent[0].payload.title).toBe('Turbine Overheat Danger');
  });

  it('Continuous breaches within cooldown window suppress duplicate notifications (Dedup + Cooldown)', async () => {
    mockNotifier.clear();

    // Breach 1
    const alert1 = await AlertService.handleBreachEvent({
      tenantId: 'factory-test',
      workflowId: 'wf-temp',
      workflowVersion: 1,
      executionId: 'exec-1',
      nodeId: 'alert-node-1',
      deviceId: 'turbine-x',
      severity: 'critical',
      title: 'Turbine Overheat Danger',
      condition: '>',
      observedValue: 89.0,
      threshold: 80.0,
      cooldownSeconds: 60,
    });

    // Breach 2 (immediately after, within 60s cooldown)
    const alert2 = await AlertService.handleBreachEvent({
      tenantId: 'factory-test',
      workflowId: 'wf-temp',
      workflowVersion: 1,
      executionId: 'exec-1',
      nodeId: 'alert-node-1',
      deviceId: 'turbine-x',
      severity: 'critical',
      title: 'Turbine Overheat Danger',
      condition: '>',
      observedValue: 92.5,
      threshold: 80.0,
      cooldownSeconds: 60,
    });

    expect(alert2.id).toBe(alert1.id); // Same deduplicated alert record
    expect(alert2.observedValue).toBe(92.5); // Updated to latest reading

    // Verified: No duplicate notification sent during cooldown!
    expect(mockNotifier.getSent().length).toBe(0);
  });

  it('Acknowledge alert transitions state: FIRING -> ACKNOWLEDGED', async () => {
    const listRes = await request(app)
      .get('/api/alerts')
      .query({ tenantId: 'factory-test', state: 'FIRING' });

    expect(listRes.status).toBe(200);
    const alertId = listRes.body.data[0].id;

    const ackRes = await request(app)
      .post(`/api/alerts/${alertId}/ack`)
      .query({ tenantId: 'factory-test' })
      .send({ user: 'chief-engineer-bob' });

    expect(ackRes.status).toBe(200);
    expect(ackRes.body.success).toBe(true);
    expect(ackRes.body.data.state).toBe('ACKNOWLEDGED');
    expect(ackRes.body.data.acknowledgedBy).toBe('chief-engineer-bob');
    expect(ackRes.body.data.acknowledgedAt).toBeDefined();
  });

  it('Resolve alert transitions state: ACKNOWLEDGED -> RESOLVED', async () => {
    const listRes = await request(app)
      .get('/api/alerts')
      .query({ tenantId: 'factory-test', state: 'ACKNOWLEDGED' });

    const alertId = listRes.body.data[0].id;

    const resRes = await request(app)
      .post(`/api/alerts/${alertId}/resolve`)
      .query({ tenantId: 'factory-test' })
      .send({ user: 'shift-supervisor' });

    expect(resRes.status).toBe(200);
    expect(resRes.body.success).toBe(true);
    expect(resRes.body.data.state).toBe('RESOLVED');
    expect(resRes.body.data.resolvedBy).toBe('shift-supervisor');
    expect(resRes.body.data.resolvedAt).toBeDefined();
  });

  it('Failure mode: Notifier throwing error does NOT crash alert creation or process', async () => {
    const failingNotifier: INotifier = {
      channel: 'failing',
      send: async () => {
        throw new Error('Downstream SMS gateway timeout');
      },
    };

    AlertService.setNotifier(failingNotifier);

    const alert = await AlertService.handleBreachEvent({
      tenantId: 'factory-test',
      workflowId: 'wf-fail',
      workflowVersion: 1,
      executionId: 'exec-f',
      nodeId: 'alert-f',
      deviceId: 'turbine-fail',
      severity: 'warning',
      title: 'Warning Test',
      condition: '>',
      observedValue: 85.0,
      threshold: 80.0,
      cooldownSeconds: 60,
    });

    // Alert record was safely saved in MongoDB despite notifier timeout!
    expect(alert).toBeDefined();
    expect(alert.state).toBe('FIRING');

    // Restore mock notifier
    AlertService.setNotifier(mockNotifier);
  });

  it('End-to-End: Starting live workflow, ingesting telemetry, and automatically firing alert', async () => {
    mockNotifier.clear();

    // 1. Create and publish workflow
    await WorkflowService.createWorkflow('factory-e2e', 'wf-e2e-demo', 'E2E Workflow', demoMvpWorkflow);
    await WorkflowService.publishWorkflow('factory-e2e', 'wf-e2e-demo');

    // 2. Register device
    const device = await DeviceService.createDevice({
      tenantId: 'factory-e2e',
      id: 'turbine-01',
      name: 'E2E Turbine',
      type: 'turbine',
    });

    // 3. Start workflow execution
    const startRes = await request(app)
      .post('/api/workflows/wf-e2e-demo/start')
      .query({ tenantId: 'factory-e2e' });
    expect(startRes.status).toBe(200);
    expect(startRes.body.data.status).toBe('active');

    // 4. Ingest 5 breach readings (moving avg window 5 > 80C)
    for (let i = 1; i <= 5; i++) {
      await request(app)
        .post('/api/telemetry?durable=true')
        .set('x-device-api-key', device.apiKey)
        .send({
          deviceId: 'turbine-01',
          timestamp: new Date().toISOString(),
          measurements: { temperature: { value: 88.0 + i } },
          eventId: `evt-e2e-${i}`,
        });
    }

    // 5. Query alerts
    const alertsRes = await request(app)
      .get('/api/alerts')
      .query({ tenantId: 'factory-e2e', workflowId: 'wf-e2e-demo' });

    expect(alertsRes.status).toBe(200);
    expect(alertsRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(alertsRes.body.data[0].state).toBe('FIRING');
    expect(alertsRes.body.data[0].title).toBe('Turbine Overheat Danger');

    // Stop workflow
    await request(app)
      .post('/api/workflows/wf-e2e-demo/stop')
      .query({ tenantId: 'factory-e2e' });
  });
});
