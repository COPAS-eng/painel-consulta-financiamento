import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = 'INTERNAL_ERROR',
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error('[ERROR]', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Dados inválidos',
      code: 'VALIDATION_ERROR',
      details: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const field = (err.meta?.target as string[])?.join(', ') || 'campo';
      return res.status(409).json({
        error: `${field} já está em uso`,
        code: 'DUPLICATE_ENTRY',
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: 'Registro não encontrado',
        code: 'NOT_FOUND',
      });
    }
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      details: err.details,
    });
  }

  if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'JSON inválido no corpo da requisição',
      code: 'INVALID_JSON',
    });
  }

  return res.status(500).json({
    error: 'Erro interno do servidor',
    code: 'INTERNAL_ERROR',
  });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: 'Rota não encontrada', code: 'NOT_FOUND' });
}