import { Router, Request, Response, NextFunction } from 'express';
import { deviceAuthMiddleware } from '../middleware/deviceAuth.js';
import { TelemetryService, IngestionResult } from '../services/TelemetryService.js';
import { ApiResponse } from '@nexusflow/shared';

export const telemetryRouter = Router();

// Ingest telemetry endpoint
telemetryRouter.post(
  '/api/telemetry',
  deviceAuthMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
      const tenantId = req.tenantId || req.device?.tenantId || 'default-tenant';
      const durable = req.query.durable === 'true';

      const result = await TelemetryService.processReadings(tenantId, req.body, { durable });

      const response: ApiResponse<IngestionResult> = {
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          correlationId,
        },
      };

      // 201 Created for durable synchronous write, 202 Accepted for standard async buffer
      const statusCode = durable ? 201 : 202;
      res.status(statusCode).json(response);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'statusCode' in err) {
        const customErr = err as { statusCode: number; code: string; message: string };
        res.status(customErr.statusCode).json({
          success: false,
          error: {
            code: customErr.code || 'BAD_REQUEST',
            message: customErr.message,
          },
        });
        return;
      }
      next(err);
    }
  }
);

// Query historical telemetry endpoint
telemetryRouter.get('/api/telemetry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const tenantId = (req.query.tenantId as string) || 'default-tenant';
    const deviceId = req.query.deviceId as string;

    if (!deviceId) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_DEVICE_ID',
          message: 'Query parameter deviceId is required',
        },
      });
      return;
    }

    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

    const data = await TelemetryService.queryHistorical(tenantId, deviceId, from, to, limit);

    const response: ApiResponse<typeof data> = {
      success: true,
      data,
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
