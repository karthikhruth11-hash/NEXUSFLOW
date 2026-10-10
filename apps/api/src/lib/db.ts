import { MongoClient, Db } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { env } from '../config/env.js';
import { logger } from './logger.js';

let client: MongoClient | null = null;
let db: Db | null = null;
let memoryServer: MongoMemoryServer | null = null;

export async function connectDb(): Promise<Db> {
  if (db && client) {
    return db;
  }

  let connectionUri = env.MONGODB_URI;

  if (connectionUri === 'memory://' || (!process.env.MONGODB_URI && env.NODE_ENV === 'test')) {
    logger.info('Initializing embedded MongoDB memory server...');
    const isWindowsArm = process.platform === 'win32' && process.arch === 'arm64';
    memoryServer = await MongoMemoryServer.create({
      binary: isWindowsArm ? { arch: 'x64' } : undefined,
    });
    connectionUri = memoryServer.getUri();
    logger.info({ uri: connectionUri }, 'MongoDB Memory Server started');
  }

  logger.info({ uri: connectionUri.replace(/\/\/.*@/, '//***@') }, 'Connecting to MongoDB...');
  client = new MongoClient(connectionUri, {
    maxPoolSize: 50,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
  });

  await client.connect();
  db = client.db(env.MONGODB_DB_NAME);
  logger.info({ dbName: env.MONGODB_DB_NAME }, 'Successfully connected to MongoDB');

  await initCollections(db);
  return db;
}

export async function initCollections(database: Db): Promise<void> {
  try {
    const existingCollections = await database.listCollections().toArray();
    const collectionNames = new Set(existingCollections.map((c) => c.name));

    // 1. Time Series Collection for Telemetry
    if (!collectionNames.has('telemetry')) {
      logger.info('Creating telemetry time-series collection...');
      await database.createCollection('telemetry', {
        timeseries: {
          timeField: 'timestamp',
          metaField: 'meta',
          granularity: 'seconds',
        },
      });
    }

    // Ensure indexes on telemetry collection
    const telemetryCol = database.collection('telemetry');
    await telemetryCol.createIndex({ 'meta.tenantId': 1, 'meta.deviceId': 1, timestamp: -1 });

    // 2. Regular Collections & Indexes
    const workflowsCol = database.collection('workflows');
    await workflowsCol.createIndex({ tenantId: 1, id: 1 }, { unique: true });
    await workflowsCol.createIndex({ tenantId: 1, status: 1 });

    const workflowVersionsCol = database.collection('workflow_versions');
    await workflowVersionsCol.createIndex({ tenantId: 1, workflowId: 1, version: 1 }, { unique: true });

    const devicesCol = database.collection('devices');
    await devicesCol.createIndex({ tenantId: 1, id: 1 }, { unique: true });

    const alertsCol = database.collection('alerts');
    await alertsCol.createIndex({ tenantId: 1, state: 1, createdAt: -1 });
    await alertsCol.createIndex({ tenantId: 1, dedupKey: 1 });

    logger.info('Database collections and indexes initialized successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize collections and indexes');
    throw error;
  }
}

export function getDb(): Db {
  if (!db) {
    throw new Error('Database is not initialized. Call connectDb() first.');
  }
  return db;
}

export function getClient(): MongoClient {
  if (!client) {
    throw new Error('MongoClient is not initialized. Call connectDb() first.');
  }
  return client;
}

export async function pingDb(): Promise<{ ok: boolean; latencyMs: number; message?: string }> {
  if (!client || !db) {
    return { ok: false, latencyMs: 0, message: 'Database client not connected' };
  }
  const start = performance.now();
  try {
    await db.command({ ping: 1 });
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    return { ok: true, latencyMs };
  } catch (err: unknown) {
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, latencyMs, message };
  }
}

export async function disconnectDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
    logger.info('MongoDB client connection closed');
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
    logger.info('MongoDB Memory Server stopped');
  }
}
