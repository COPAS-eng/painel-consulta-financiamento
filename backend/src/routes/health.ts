import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const healthRoutes = async (req: Request, res: Response) => {
  const start = Date.now();

  let dbStatus = 'ok';
  let dbLatency = 0;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - dbStart;
  } catch {
    dbStatus = 'error';
  }

  const partners = await prisma.partnerConfig.findMany({
    where: { isActive: true },
    select: { name: true, isTestEnv: true },
  });

  res.json({
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: { status: dbStatus, latencyMs: dbLatency },
    partners: partners.map(p => ({ name: p.name, isTestEnv: p.isTestEnv })),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
  });
};