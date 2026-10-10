import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDb, disconnectDb } from '../src/lib/db.js';

describe('Health and Readiness Endpoints', () => {
  const app = createApp();

  beforeAll(async () => {
    // In test environment, connectDb initializes memory server automatically
    await connectDb();
  });

  afterAll(async () => {
    await disconnectDb();
  });

  it('GET /health returns 200 with status ok and memory check', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.version).toBe('1.0.0');
    expect(typeof res.body.data.uptimeSeconds).toBe('number');
    expect(res.body.data.checks.memory.status).toBe('ok');
    expect(res.headers['x-correlation-id']).toBeDefined();
  });

  it('GET /ready returns 200 with database check ok and latency', async () => {
    const res = await request(app).get('/ready');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.checks.database.status).toBe('ok');
    expect(typeof res.body.data.checks.database.latencyMs).toBe('number');
    expect(res.body.data.checks.memory.heapUsedMb).toBeGreaterThan(0);
  });

  it('GET non-existent route returns 404 with structured error', async () => {
    const res = await request(app).get('/api/unknown-endpoint');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
