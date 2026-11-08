import { Router, Response } from 'express';
import { body, param } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.js';
import { validate } from '../utils/validate.js';

const router = Router();

router.get('/', authMiddleware, requireRole('ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const configs = await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } });
  res.json(configs.map(c => ({ key: c.key, value: c.value, updatedAt: c.updatedAt })));
});

router.get('/:key', authMiddleware, requireRole('ADMIN'), [param('key').trim().isLength({ min: 1 })], validate, async (req: AuthenticatedRequest, res: Response) => {
  const config = await prisma.systemConfig.findUnique({ where: { key: req.params.key } });
  if (!config) return res.status(404).json({ error: 'Configuração não encontrada' });
  res.json(config);
});

router.post('/', authMiddleware, requireRole('ADMIN'), [
  body('key').trim().isLength({ min: 1, max: 100 }).matches(/^[a-z_]+$/).withMessage('Chave deve conter apenas letras minúsculas e underscore'),
  body('value').notEmpty().withMessage('Valor é obrigatório'),
], validate, async (req: AuthenticatedRequest, res: Response) => {
  const config = await prisma.systemConfig.create({ data: req.body });
  res.status(201).json(config);
});

router.put('/:key', authMiddleware, requireRole('ADMIN'), [
  param('key').trim().isLength({ min: 1 }),
  body('value').notEmpty().withMessage('Valor é obrigatório'),
], validate, async (req: AuthenticatedRequest, res: Response) => {
  const config = await prisma.systemConfig.upsert({
    where: { key: req.params.key },
    create: { key: req.params.key, value: req.body.value },
    update: { value: req.body.value },
  });
  res.json(config);
});

router.delete('/:key', authMiddleware, requireRole('ADMIN'), [param('key').trim().isLength({ min: 1 })], validate, async (req: AuthenticatedRequest, res: Response) => {
  await prisma.systemConfig.delete({ where: { key: req.params.key } });
  res.json({ deleted: true });
});

export default router;