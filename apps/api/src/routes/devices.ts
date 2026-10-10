import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DeviceService } from '../services/DeviceService.js';
import { ApiResponse, Device } from '@nexusflow/shared';

export const devicesRouter = Router();

const CreateDeviceBodySchema = z.object({
  id: z.string().trim().min(1).max(128),
  tenantId: z.string().trim().min(1).default('default-tenant'),
  name: z.string().trim().min(1).max(128),
  type: z.string().trim().min(1).max(64).default('sensor'),
});

// Create device and obtain API key
devicesRouter.post('/api/devices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const body = CreateDeviceBodySchema.parse(req.body);

    const result = await DeviceService.createDevice(body);

    const response: ApiResponse<{ device: Device; apiKey: string }> = {
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
      },
    };

    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

// List devices
devicesRouter.get('/api/devices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const tenantId = (req.query.tenantId as string) || 'default-tenant';

    const devices = await DeviceService.listDevices(tenantId);

    const response: ApiResponse<Device[]> = {
      success: true,
      data: devices,
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
      },
    };

    res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});
