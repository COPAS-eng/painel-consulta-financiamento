import { Router, Response } from 'express';
import { body, param, query } from 'express-validator';
import { prisma } from '../lib/prisma.js';
import { partnerRegistry } from '../integrations/index.js';
import { MockPartnerAdapter } from '../integrations/mockAdapter.js';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.js';
import { validate } from '../utils/validate.js';

const router = Router();

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const partners = await prisma.partnerConfig.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const withStatus = partners.map(p => {
    const adapter = partnerRegistry.get(p.name);
    return {
      ...p,
      credentials: undefined,
      isConfigured: adapter?.isConfigured ?? false,
      isTestEnvironment: adapter?.isTestEnvironment ?? p.isTestEnv,
    };
  });

  res.json(withStatus);
});

router.get('/active', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const activeAdapters = partnerRegistry.getActive();
  const partners = await prisma.partnerConfig.findMany({
    where: { name: { in: activeAdapters.map(a => a.name) } },
  });

  res.json(activeAdapters.map(a => {
    const config = partners.find(p => p.name === a.name);
    return {
      id: config?.id,
      name: a.name,
      displayName: a.displayName,
      requiredFields: a.requiredFields,
      isTestEnvironment: a.isTestEnvironment,
    };
  }));
});

router.get('/:id', authMiddleware, requireRole('ADMIN'), [param('id').isUUID()], validate, async (req: AuthenticatedRequest, res: Response) => {
  const partner = await prisma.partnerConfig.findUnique({ where: { id: req.params.id } });
  if (!partner) return res.status(404).json({ error: 'Parceiro não encontrado' });

  const adapter = partnerRegistry.get(partner.name);
  res.json({
    ...partner,
    credentials: undefined,
    isConfigured: adapter?.isConfigured ?? false,
    isTestEnvironment: adapter?.isTestEnvironment ?? partner.isTestEnv,
  });
});

router.post('/', authMiddleware, requireRole('ADMIN'), [
  body('name').trim().isLength({ min: 2, max: 50 }).matches(/^[a-z_]+$/).withMessage('Nome deve conter apenas letras minúsculas e underscore'),
  body('displayName').trim().isLength({ min: 2, max: 100 }).withMessage('Nome de exibição inválido'),
  body('baseUrl').isURL().withMessage('URL base inválida'),
  body('authType').isIn(['none', 'api_key', 'oauth2', 'basic', 'bearer']).withMessage('Tipo de autenticação inválido'),
  body('credentials').isObject().withMessage('Credenciais devem ser um objeto'),
  body('isActive').optional().isBoolean(),
  body('isTestEnv').optional().isBoolean(),
  body('rateLimit').optional().isInt({ min: 1, max: 1000 }),
  body('requiredFields').isArray({ min: 1 }).withMessage('Pelo menos um campo obrigatório'),
  body('requiredFields.*').isString(),
], validate, async (req: AuthenticatedRequest, res: Response) => {
  const partner = await prisma.partnerConfig.create({ data: req.body });

  if (partner.name === 'mock') {
    partnerRegistry.register(new MockPartnerAdapter(partner as any));
  }

  res.status(201).json({ ...partner, credentials: undefined });
});

router.patch('/:id', authMiddleware, requireRole('ADMIN'), [
  param('id').isUUID(),
  body('displayName').optional().trim().isLength({ min: 2, max: 100 }),
  body('baseUrl').optional().isURL(),
  body('authType').optional().isIn(['none', 'api_key', 'oauth2', 'basic', 'bearer']),
  body('credentials').optional().isObject(),
  body('isActive').optional().isBoolean(),
  body('isTestEnv').optional().isBoolean(),
  body('rateLimit').optional().isInt({ min: 1, max: 1000 }),
  body('requiredFields').optional().isArray({ min: 1 }),
  body('requiredFields.*').optional().isString(),
], validate, async (req: AuthenticatedRequest, res: Response) => {
  const partner = await prisma.partnerConfig.update({
    where: { id: req.params.id },
    data: req.body,
  });

  if (partner.name === 'mock') {
    partnerRegistry.unregister('mock');
    partnerRegistry.register(new MockPartnerAdapter(partner as any));
  }

  res.json({ ...partner, credentials: undefined });
});

router.post('/:id/test', authMiddleware, requireRole('ADMIN'), [param('id').isUUID()], validate, async (req: AuthenticatedRequest, res: Response) => {
  const partner = await prisma.partnerConfig.findUnique({ where: { id: req.params.id } });
  if (!partner) return res.status(404).json({ error: 'Parceiro não encontrado' });

  const adapter = partnerRegistry.get(partner.name);
  if (!adapter) return res.status(400).json({ error: 'Adaptador não registrado para este parceiro' });

  const validation = await adapter.validateConfig();
  res.json({ valid: validation.valid, errors: validation.errors });
});

router.post('/:id/set-default', authMiddleware, requireRole('ADMIN'), [param('id').isUUID()], validate, async (req: AuthenticatedRequest, res: Response) => {
  const partner = await prisma.partnerConfig.findUnique({ where: { id: req.params.id } });
  if (!partner) return res.status(404).json({ error: 'Parceiro não encontrado' });

  const success = partnerRegistry.setDefault(partner.name);
  if (!success) return res.status(400).json({ error: 'Parceiro não está configurado para ser padrão' });

  res.json({ success: true, defaultPartner: partner.name });
});

router.delete('/:id', authMiddleware, requireRole('ADMIN'), [param('id').isUUID()], validate, async (req: AuthenticatedRequest, res: Response) => {
  const partner = await prisma.partnerConfig.findUnique({ where: { id: req.params.id } });
  if (!partner) return res.status(404).json({ error: 'Parceiro não encontrado' });

  partnerRegistry.unregister(partner.name);
  await prisma.partnerConfig.delete({ where: { id: req.params.id } });
  res.json({ deleted: true });
});

export default router;