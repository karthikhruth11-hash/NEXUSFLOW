import crypto from 'crypto';
import { getDb } from '../lib/db.js';
import { Device } from '@nexusflow/shared';

export interface CreateDeviceInput {
  tenantId: string;
  id: string;
  name: string;
  type: string;
}

export interface CreateDeviceResult {
  device: Device;
  apiKey: string;
}

export class DeviceService {
  private static hashApiKey(apiKey: string): string {
    return crypto.createHash('sha256').update(apiKey).digest('hex');
  }

  static async createDevice(input: CreateDeviceInput): Promise<CreateDeviceResult> {
    const db = getDb();
    const rawApiKey = `devkey_${crypto.randomBytes(24).toString('hex')}`;
    const apiKeyHash = this.hashApiKey(rawApiKey);

    const device: Device = {
      id: input.id,
      tenantId: input.tenantId,
      name: input.name,
      type: input.type,
      apiKeyHash,
      status: 'offline',
      createdAt: new Date().toISOString(),
    };

    const devicesCol = db.collection<Device>('devices');
    await devicesCol.updateOne(
      { tenantId: input.tenantId, id: input.id },
      { $set: device },
      { upsert: true }
    );

    return {
      device,
      apiKey: rawApiKey,
    };
  }

  static async authenticateKey(apiKey: string): Promise<Device | null> {
    if (!apiKey || typeof apiKey !== 'string') {
      return null;
    }
    const hash = this.hashApiKey(apiKey);
    const db = getDb();
    const device = await db.collection<Device>('devices').findOne({ apiKeyHash: hash });
    return device;
  }

  static async listDevices(tenantId: string): Promise<Device[]> {
    const db = getDb();
    return db.collection<Device>('devices').find({ tenantId }).toArray();
  }

  static async getDevice(tenantId: string, id: string): Promise<Device | null> {
    const db = getDb();
    return db.collection<Device>('devices').findOne({ tenantId, id });
  }

  static async updateLastSeen(tenantId: string, id: string, timestamp: string): Promise<void> {
    const db = getDb();
    await db.collection<Device>('devices').updateOne(
      { tenantId, id },
      {
        $set: {
          lastSeenAt: timestamp,
          status: 'online',
        },
      }
    );
  }
}
