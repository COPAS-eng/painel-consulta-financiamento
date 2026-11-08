import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

export function validate(req: Request, res: Response, next: NextFunction) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      code: 'VALIDATION_ERROR',
      details: errors.array().map(e => ({
        field: e.type === 'field' ? e.path : 'unknown',
        message: e.msg,
      })),
    });
  }
  next();
}