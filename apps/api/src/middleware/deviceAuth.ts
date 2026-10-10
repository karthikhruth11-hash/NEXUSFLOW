import { Request, Response, NextFunction } from 'express';
import { DeviceService } from '../services/DeviceService.js';
import { Device } from '@nexusflow/shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      device?: Device;
      tenantId?: string;
    }
  }
}

export async function deviceAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-device-api-key'];

  if (!apiKey || typeof apiKey !== 'string') {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid x-device-api-key header',
      },
    });
    return;
  }

  const device = await DeviceService.authenticateKey(apiKey);
  if (!device) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Device API key is invalid',
      },
    });
    return;
  }

  req.device = device;
  req.tenantId = device.tenantId;

  // Authorization check: Device can only post its own deviceId
  const body = req.body;
  if (body) {
    if (typeof body.deviceId === 'string' && body.deviceId !== device.id) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_DEVICE_MISMATCH',
          message: `Device key for '${device.id}' cannot submit data for '${body.deviceId}'`,
        },
      });
      return;
    }

    if (Array.isArray(body.readings)) {
      for (const reading of body.readings) {
        if (reading.deviceId && reading.deviceId !== device.id) {
          res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN_DEVICE_MISMATCH',
              message: `Device key for '${device.id}' cannot submit data for '${reading.deviceId}'`,
            },
          });
          return;
        }
      }
    }
  }

  next();
}
