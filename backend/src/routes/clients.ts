import { Router, Response } from 'express';
import { body, query, param } from 'express-validator';
import { clientService } from '../services/clientService.js';
import { authMiddleware, AuthenticatedRequest, requireRole } from '../middleware/auth.js';
import { validate } from '../utils/validate.js';

const router = Router();

const clientValidation = [
  body('fullName').trim().isLength({ min: 2, max: 200 }).withMessage('Nome completo deve ter entre 2 e 200 caracteres'),
  body('cpf').matches(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/).withMessage('CPF inválido'),
  body('birthDate').isISO8601().withMessage('Data de nascimento inválida (use YYYY-MM-DD)'),
  body('rg').optional().trim().isLength({ max: 20 }).withMessage('RG muito longo'),
  body('email').optional().isEmail().normalizeEmail().withMessage('E-mail inválido'),
  body('phone').optional().trim().matches(/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/).withMessage('Telefone inválido'),
  body('monthlyIncome').optional().isFloat({ min: 0 }).withMessage('Renda deve ser um número positivo'),
  body('profession').optional().trim().isLength({ max: 100 }).withMessage('Profissão muito longa'),
  body('maritalStatus').optional().trim().isLength({ max: 50 }).withMessage('Estado civil muito longo'),
  body('address').optional().isObject().withMessage('Endereço deve ser um objeto'),
];

router.post('/', authMiddleware, clientValidation, validate, async (req: AuthenticatedRequest, res: Response) => {
  const client = await clientService.create({ ...req.body, createdById: req.user!.id });
  res.status(201).json(client);
});

router.get('/', authMiddleware, [
  query('search').optional().trim(),
  query('status').optional().isIn(['ACTIVE', 'INACTIVE', 'ARCHIVED']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
], validate, async (req: AuthenticatedRequest, res: Response) => {
  const result = await clientService.list(req.query as Record<string, string>, req.user!.id, req.user!.role);
  res.json(result);
});

router.get('/:id', authMiddleware, [param('id').isUUID().withMessage('ID inválido')], validate, async (req: AuthenticatedRequest, res: Response) => {
  const client = await clientService.getById(req.params.id, req.user!.id, req.user!.role);
  if (!client) {
    return res.status(404).json({ error: 'Cliente não encontrado' });
  }
  res.json(client);
});

router.get('/:id/sensitive', authMiddleware, requireRole('ADMIN'), [param('id').isUUID().withMessage('ID inválido')], validate, async (req: AuthenticatedRequest, res: Response) => {
  const client = await clientService.getById(req.params.id, req.user!.id, req.user!.role, true);
  if (!client) {
    return res.status(404).json({ error: 'Cliente não encontrado' });
  }
  res.json(client);
});

router.patch('/:id', authMiddleware, [
  param('id').isUUID().withMessage('ID inválido'),
  body('fullName').optional().trim().isLength({ min: 2, max: 200 }),
  body('cpf').optional().matches(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/),
  body('birthDate').optional().isISO8601(),
  body('rg').optional().trim().isLength({ max: 20 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().trim().matches(/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/),
  body('monthlyIncome').optional().isFloat({ min: 0 }),
  body('profession').optional().trim().isLength({ max: 100 }),
  body('maritalStatus').optional().trim().isLength({ max: 50 }),
  body('address').optional().isObject(),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'ARCHIVED']),
], validate, async (req: AuthenticatedRequest, res: Response) => {
  const client = await clientService.update(req.params.id, req.body, req.user!.id);
  res.json(client);
});

router.delete('/:id', authMiddleware, [param('id').isUUID().withMessage('ID inválido')], validate, async (req: AuthenticatedRequest, res: Response) => {
  const result = await clientService.delete(req.params.id, req.user!.id, req.user!.role);
  res.json(result);
});

router.get('/:id/consents', authMiddleware, [param('id').isUUID().withMessage('ID inválido')], validate, async (req: AuthenticatedRequest, res: Response) => {
  const consents = await clientService.getConsents(req.params.id);
  res.json(consents);
});

router.post('/:id/consents', authMiddleware, [
  param('id').isUUID().withMessage('ID inválido'),
  body('purpose').trim().isLength({ min: 10, max: 500 }).withMessage('Finalidade deve ter entre 10 e 500 caracteres'),
  body('partnerName').trim().isLength({ min: 2, max: 100 }).withMessage('Nome do parceiro inválido'),
  body('partnerEndpoint').isURL().withMessage('Endpoint do parceiro inválido'),
  body('dataFields').isArray({ min: 1 }).withMessage('Pelo menos um campo de dados é obrigatório'),
  body('dataFields.*').isString().withMessage('Campos de dados devem ser strings'),
  body('expiresAt').optional().isISO8601().withMessage('Data de expiração inválida'),
], validate, async (req: AuthenticatedRequest, res: Response) => {
  const consent = await clientService.createConsent(req.params.id, {
    ...req.body,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.status(201).json(consent);
});

router.post('/consents/:consentId/revoke', authMiddleware, [param('consentId').isUUID().withMessage('ID inválido')], validate, async (req: AuthenticatedRequest, res: Response) => {
  await clientService.revokeConsent(req.params.consentId, req.user!.id);
  res.json({ revoked: true });
});

export default router;