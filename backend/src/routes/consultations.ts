import { Router, Response } from 'express';
import { body, query, param } from 'express-validator';
import { consultationService } from '../services/consultationService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { validate } from '../utils/validate.js';

const router = Router();

router.post('/', authMiddleware, [
  body('clientId').isUUID().withMessage('ID do cliente inválido'),
  body('partnerId').isUUID().withMessage('ID do parceiro inválido'),
  body('financingData.propertyValue').isFloat({ min: 1000 }).withMessage('Valor do imóvel deve ser maior que 1000'),
  body('financingData.downPayment').isFloat({ min: 0 }).withMessage('Valor da entrada não pode ser negativo'),
  body('financingData.termMonths').isInt({ min: 1, max: 480 }).withMessage('Prazo deve ser entre 1 e 480 meses'),
  body('financingData.interestRate').optional().isFloat({ min: 0, max: 1 }).withMessage('Taxa de juros deve ser entre 0 e 1'),
  body('consentId').isUUID().withMessage('ID do consentimento inválido'),
], validate, async (req: AuthenticatedRequest, res: Response) => {
  const result = await consultationService.createAndExecute({
    ...req.body,
    requestedById: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
  res.status(201).json(result);
});

router.get('/', authMiddleware, [
  query('clientId').optional().isUUID().withMessage('ID do cliente inválido'),
  query('requestedById').optional().isUUID().withMessage('ID do solicitante inválido'),
  query('status').optional().isIn(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'UNAVAILABLE', 'EXPIRED']),
  query('partnerName').optional().trim(),
  query('startDate').optional().isISO8601().withMessage('Data inicial inválida'),
  query('endDate').optional().isISO8601().withMessage('Data final inválida'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
], validate, async (req: AuthenticatedRequest, res: Response) => {
  const filters = {
    ...req.query,
    startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
    endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    userId: req.user!.id,
    userRole: req.user!.role,
  };
  const result = await consultationService.getHistory(filters);
  res.json(result);
});

router.get('/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const stats = await consultationService.getStats(req.user!.id, req.user!.role);
  res.json(stats);
});

router.get('/:id', authMiddleware, [param('id').isUUID().withMessage('ID inválido')], validate, async (req: AuthenticatedRequest, res: Response) => {
  const consultation = await consultationService.getById(req.params.id, req.user!.id, req.user!.role);
  if (!consultation) {
    return res.status(404).json({ error: 'Consulta não encontrada' });
  }
  res.json(consultation);
});

export default router;