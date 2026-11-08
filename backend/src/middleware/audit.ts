import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.js';

const SENSITIVE_FIELDS = ['password', 'passwordHash', 'token', 'secret', 'key', 'cpf', 'rg', 'creditCard', 'cvv'];

function sanitizeForLog(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeForLog);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.some(f => lowerKey.includes(f))) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeForLog(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const originalSend = res.send;

  res.send = function (body?: unknown): Response {
    const duration = Date.now() - startTime;
    const authReq = req as AuthenticatedRequest;

    if (req.path.startsWith('/api/') && !req.path.includes('/health')) {
      const logData = {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration,
        userId: authReq.user?.id,
        userRole: authReq.user?.role,
        ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
        userAgent: req.headers['user-agent'],
        requestBody: sanitizeForLog(req.body),
        query: sanitizeForLog(req.query),
        params: sanitizeForLog(req.params),
      };

      if (res.statusCode >= 400 || process.env.LOG_LEVEL === 'debug') {
        console.log('[AUDIT]', JSON.stringify(logData));
      }
    }

    return originalSend.call(this, body);
  };

  next();
}