import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { correlationIdMiddleware } from './middleware/correlationId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { devicesRouter } from './routes/devices.js';
import { telemetryRouter } from './routes/telemetry.js';
import { workflowsRouter } from './routes/workflows.js';
import { alertsRouter } from './routes/alerts.js';

export function createApp(): express.Application {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS
  app.use(
    cors({
      origin: env.CORS_ORIGIN === '*' ? '*' : env.CORS_ORIGIN.split(','),
      credentials: true,
    })
  );

  // Body parsing with bounded payload size
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Correlation ID tracing
  app.use(correlationIdMiddleware);

  // Structured HTTP logging (skip during test runs for clean test output)
  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        customLogLevel: (_req, res, err) => {
          if (res.statusCode >= 500 || err) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
      })
    );
  }

  // Routes
  app.use(healthRouter);
  app.use(devicesRouter);
  app.use(telemetryRouter);
  app.use(workflowsRouter);
  app.use(alertsRouter);

  // Fallback 404 handler
  app.use((req, res) => {
    const correlationId = (req.headers['x-correlation-id'] as string) || undefined;
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
      },
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
      },
    });
  });

  // Central error handler
  app.use(errorHandler);

  return app;
}
