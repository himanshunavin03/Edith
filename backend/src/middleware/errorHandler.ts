import type { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger';
import { AppError } from '../utils/errors';

/** Centralized error handler. Never leaks stack traces or secrets to the client. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    logger.warn({ code: err.code, path: req.path }, err.message);
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
}
