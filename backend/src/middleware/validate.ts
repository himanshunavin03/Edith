import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { ValidationError } from '../utils/errors';

/** Validates req.body against a zod schema and replaces it with the parsed value. */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      next(new ValidationError(message || 'Invalid request body'));
      return;
    }
    req.body = result.data;
    next();
  };
}
