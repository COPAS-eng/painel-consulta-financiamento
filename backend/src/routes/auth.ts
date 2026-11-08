import { Router, Response } from 'express';
import { body } from 'express-validator';
import { authService } from '../services/authService.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { validate } from '../utils/validate.js';

const router = Router();

router.post('/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('E-mail inválido'),
    body('password').isLength({ min: 8 }).withMessage('Senha deve ter pelo menos 8 caracteres'),
    body('fullName').trim().isLength({ min: 2 }).withMessage('Nome completo é obrigatório'),
    body('role').optional().isIn(['ADMIN', 'BROKER', 'VIEWER']).withMessage('Role inválida'),
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    const result = await authService.register(req.body, req.user?.id);
    res.status(201).json(result);
  }
);

router.post('/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('E-mail inválido'),
    body('password').notEmpty().withMessage('Senha é obrigatória'),
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response, next: (err?: unknown) => void) => {
    try {
      const result = await authService.login(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post('/refresh',
  [body('refreshToken').notEmpty().withMessage('Refresh token é obrigatório')],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    const result = await authService.refresh(req.body.refreshToken);
    res.json(result);
  }
);

router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const profile = await authService.getProfile(req.user!.id);
  res.json(profile);
});

router.patch('/me',
  authMiddleware,
  [
    body('fullName').optional().trim().isLength({ min: 2 }).withMessage('Nome deve ter pelo menos 2 caracteres'),
    body('email').optional().isEmail().normalizeEmail().withMessage('E-mail inválido'),
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    const profile = await authService.updateProfile(req.user!.id, req.body);
    res.json(profile);
  }
);

router.post('/change-password',
  authMiddleware,
  [
    body('currentPassword').notEmpty().withMessage('Senha atual é obrigatória'),
    body('newPassword').isLength({ min: 8 }).withMessage('Nova senha deve ter pelo menos 8 caracteres'),
  ],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    await authService.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword);
    res.json({ success: true });
  }
);

router.get('/users', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const users = await authService.listUsers(req.user!.id, req.user!.role);
  res.json(users);
});

router.patch('/users/:id/status',
  authMiddleware,
  [body('status').isIn(['ACTIVE', 'INACTIVE', 'PENDING']).withMessage('Status inválido')],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    const user = await authService.updateUserStatus(req.params.id, req.body.status, req.user!.id, req.user!.role);
    res.json(user);
  }
);

router.patch('/users/:id/role',
  authMiddleware,
  [body('role').isIn(['ADMIN', 'BROKER', 'VIEWER']).withMessage('Role inválida')],
  validate,
  async (req: AuthenticatedRequest, res: Response) => {
    const user = await authService.updateUserRole(req.params.id, req.body.role, req.user!.id, req.user!.role);
    res.json(user);
  }
);

export default router;