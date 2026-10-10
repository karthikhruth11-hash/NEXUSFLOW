import { Router, Request, Response } from 'express';
import { pingDb } from '../lib/db.js';
import { HealthStatus, ApiResponse } from '@nexusflow/shared';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  const correlationId = (_req.headers['x-correlation-id'] as string) || undefined;
  const memoryUsage = process.memoryUsage();

  const data: HealthStatus = {
    status: 'ok',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {
      database: {
        status: 'ok',
      },
      memory: {
        status: 'ok',
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
      },
    },
  };

  const response: ApiResponse<HealthStatus> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      correlationId,
    },
  };

  res.status(200).json(response);
});

healthRouter.get('/ready', async (_req: Request, res: Response) => {
  const correlationId = (_req.headers['x-correlation-id'] as string) || undefined;
  const dbPing = await pingDb();
  const memoryUsage = process.memoryUsage();

  const isHealthy = dbPing.ok;
  const memoryStatus = memoryUsage.heapUsed / memoryUsage.heapTotal > 0.9 ? 'degraded' : 'ok';

  const data: HealthStatus = {
    status: isHealthy ? 'ok' : 'down',
    version: '1.0.0',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {
      database: {
        status: dbPing.ok ? 'ok' : 'down',
        latencyMs: dbPing.latencyMs,
        message: dbPing.message,
      },
      memory: {
        status: memoryStatus,
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
      },
    },
  };

  const response: ApiResponse<HealthStatus> = {
    success: isHealthy,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      correlationId,
    },
  };

  res.status(isHealthy ? 200 : 503).json(response);
});
