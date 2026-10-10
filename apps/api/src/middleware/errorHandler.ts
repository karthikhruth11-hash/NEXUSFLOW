import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';
import { ApiResponse } from '@nexusflow/shared';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const correlationId = (req.headers['x-correlation-id'] as string) || undefined;

  if (err instanceof ZodError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: err.issues,
      },
      meta: {
        timestamp: new Date().toISOString(),
        correlationId,
      },
    };
    res.status(400).json(response);
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal Server Error';
  logger.error({ err, correlationId, path: req.path }, 'Unhandled request error');

  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' ? 'Internal server error occurred' : message,
    },
    meta: {
      timestamp: new Date().toISOString(),
      correlationId,
    },
  };

  res.status(500).json(response);
}
