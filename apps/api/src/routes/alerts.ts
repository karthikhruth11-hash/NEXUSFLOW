import { Router, Request, Response, NextFunction } from 'express';
import { AlertService } from '../services/AlertService.js';
import { ApiResponse, AlertRecord, AlertState } from '@nexusflow/shared';

export const alertsRouter = Router();

// List alerts
alertsRouter.get('/api/alerts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const tenantId = (req.query.tenantId as string) || 'default-tenant';
    const state = req.query.state as AlertState | undefined;
    const severity = req.query.severity as string | undefined;
    const deviceId = req.query.deviceId as string | undefined;
    const workflowId = req.query.workflowId as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const skip = req.query.skip ? parseInt(req.query.skip as string, 10) : 0;

    const alerts = await AlertService.listAlerts(tenantId, {
      state,
      severity,
      deviceId,
      workflowId,
      limit,
      skip,
    });

    const response: ApiResponse<AlertRecord[]> = {
      success: true,
      data: alerts,
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

// Acknowledge alert
alertsRouter.post('/api/alerts/:id/ack', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const tenantId = (req.query.tenantId as string) || 'default-tenant';
    const id = req.params.id;
    const user = req.body?.user || 'operator-user';

    const updated = await AlertService.acknowledgeAlert(tenantId, id, user);
    if (!updated) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ALERT_NOT_FOUND_OR_INVALID_STATE',
          message: `Alert '${id}' not found or cannot be acknowledged from its current state`,
        },
      });
      return;
    }

    const response: ApiResponse<AlertRecord> = {
      success: true,
      data: updated,
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

// Resolve alert
alertsRouter.post('/api/alerts/:id/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    const tenantId = (req.query.tenantId as string) || 'default-tenant';
    const id = req.params.id;
    const user = req.body?.user || 'operator-user';

    const updated = await AlertService.resolveAlert(tenantId, id, user);
    if (!updated) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ALERT_NOT_FOUND',
          message: `Alert '${id}' not found`,
        },
      });
      return;
    }

    const response: ApiResponse<AlertRecord> = {
      success: true,
      data: updated,
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
