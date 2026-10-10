import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDb, disconnectDb, getDb } from '../src/lib/db.js';
import { DeviceService } from '../src/services/DeviceService.js';
import { telemetryBus } from '../src/adapters/TelemetryBus.js';

describe('Telemetry Ingestion & Device Authentication API', () => {
  const app = createApp();
  let turbineApiKey: string;
  let pumpApiKey: string;

  beforeAll(async () => {
    await connectDb();

    // Register test devices
    const turbine = await DeviceService.createDevice({
      tenantId: 'factory-1',
      id: 'turbine-01',
      name: 'Main Steam Turbine',
      type: 'turbine',
    });
    turbineApiKey = turbine.apiKey;

    const pump = await DeviceService.createDevice({
      tenantId: 'factory-1',
      id: 'pump-01',
      name: 'Coolant Pump',
      type: 'pump',
    });
    pumpApiKey = pump.apiKey;
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('rejects ingestion without x-device-api-key header', async () => {
    const res = await request(app)
      .post('/api/telemetry')
      .send({
        deviceId: 'turbine-01',
        timestamp: new Date().toISOString(),
        measurements: { temperature: { value: 72.5 } },
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects ingestion with invalid device API key', async () => {
    const res = await request(app)
      .post('/api/telemetry')
      .set('x-device-api-key', 'invalid-key-xyz')
      .send({
        deviceId: 'turbine-01',
        timestamp: new Date().toISOString(),
        measurements: { temperature: { value: 72.5 } },
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('forbids device from submitting telemetry for a different deviceId', async () => {
    // pumpApiKey trying to submit data for turbine-01
    const res = await request(app)
      .post('/api/telemetry')
      .set('x-device-api-key', pumpApiKey)
      .send({
        deviceId: 'turbine-01',
        timestamp: new Date().toISOString(),
        measurements: { temperature: { value: 72.5 } },
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN_DEVICE_MISMATCH');
  });

  it('accepts valid single telemetry reading with 202 Accepted and dispatches to TelemetryBus', async () => {
    let busReceived = false;
    const unsubscribe = telemetryBus.subscribe((record) => {
      if (record.deviceId === 'turbine-01') {
        busReceived = true;
      }
    });

    const res = await request(app)
      .post('/api/telemetry')
      .set('x-device-api-key', turbineApiKey)
      .send({
        deviceId: 'turbine-01',
        timestamp: new Date().toISOString(),
        measurements: {
          temperature: { value: 74.2, unit: 'celsius' },
          vibration: { value: 1.8, unit: 'mm/s' },
        },
        eventId: 'evt-test-01',
      });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accepted).toBe(1);
    expect(res.body.data.ingestTimestamp).toBeDefined();
    expect(busReceived).toBe(true);

    unsubscribe();
  });

  it('accepts synchronous durable ingestion with 201 Created (?durable=true)', async () => {
    const res = await request(app)
      .post('/api/telemetry?durable=true')
      .set('x-device-api-key', turbineApiKey)
      .send({
        deviceId: 'turbine-01',
        timestamp: new Date().toISOString(),
        measurements: {
          temperature: { value: 75.0, unit: 'celsius' },
        },
        eventId: 'evt-test-durable-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accepted).toBe(1);

    // Verify document in MongoDB collection
    const db = getDb();
    const doc = await db.collection('telemetry').findOne({ eventId: 'evt-test-durable-01' });
    expect(doc).toBeDefined();
    expect(doc?.measurements?.temperature?.value).toBe(75.0);
  });

  it('idempotently handles duplicate eventId without duplicate window dispatch', async () => {
    const duplicateEventId = 'evt-duplicate-123';
    const payload = {
      deviceId: 'turbine-01',
      timestamp: new Date().toISOString(),
      measurements: { temperature: { value: 76.1 } },
      eventId: duplicateEventId,
    };

    // First submission
    const res1 = await request(app)
      .post('/api/telemetry?durable=true')
      .set('x-device-api-key', turbineApiKey)
      .send(payload);
    expect(res1.status).toBe(201);
    expect(res1.body.data.duplicates).toBe(0);

    // Second submission with exact same eventId
    const res2 = await request(app)
      .post('/api/telemetry?durable=true')
      .set('x-device-api-key', turbineApiKey)
      .send(payload);
    expect(res2.status).toBe(201);
    expect(res2.body.data.duplicates).toBe(1);
  });

  it('rejects far-future timestamps exceeding clock skew tolerance (>10s in future)', async () => {
    const futureDate = new Date(Date.now() + 60 * 1000).toISOString(); // 60s in future

    const res = await request(app)
      .post('/api/telemetry')
      .set('x-device-api-key', turbineApiKey)
      .send({
        deviceId: 'turbine-01',
        timestamp: futureDate,
        measurements: { temperature: { value: 80.0 } },
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CLOCK_SKEW_FUTURE');
  });

  it('persists late telemetry (>60s old) with late flag but excludes from live bus', async () => {
    let busReceivedLate = false;
    const unsubscribe = telemetryBus.subscribe((record) => {
      if (record.eventId === 'evt-late-test-99') {
        busReceivedLate = true;
      }
    });

    const pastDate = new Date(Date.now() - 120 * 1000).toISOString(); // 120s in past

    const res = await request(app)
      .post('/api/telemetry?durable=true')
      .set('x-device-api-key', turbineApiKey)
      .send({
        deviceId: 'turbine-01',
        timestamp: pastDate,
        measurements: { temperature: { value: 70.0 } },
        eventId: 'evt-late-test-99',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.late).toBe(1);
    expect(busReceivedLate).toBe(false); // Verified excluded from live streaming windows!

    // Check DB record has late: true
    const db = getDb();
    const doc = await db.collection('telemetry').findOne({ eventId: 'evt-late-test-99' });
    expect(doc?.meta?.late).toBe(true);

    unsubscribe();
  });

  it('accepts batch readings in a single POST', async () => {
    const res = await request(app)
      .post('/api/telemetry?durable=true')
      .set('x-device-api-key', turbineApiKey)
      .send({
        readings: [
          {
            deviceId: 'turbine-01',
            timestamp: new Date().toISOString(),
            measurements: { temperature: { value: 71.0 } },
          },
          {
            deviceId: 'turbine-01',
            timestamp: new Date().toISOString(),
            measurements: { temperature: { value: 71.5 } },
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.data.accepted).toBe(2);
  });

  it('queries historical telemetry stored in MongoDB Time Series collection', async () => {
    const res = await request(app)
      .get('/api/telemetry')
      .query({ tenantId: 'factory-1', deviceId: 'turbine-01', limit: 5 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].deviceId).toBe('turbine-01');
  });
});
