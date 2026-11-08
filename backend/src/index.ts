import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
import { auditMiddleware } from './middleware/audit.js';
import authRoutes from './routes/auth.js';
import clientRoutes from './routes/clients.js';
import consultationRoutes from './routes/consultations.js';
import partnerRoutes from './routes/partners.js';
import configRoutes from './routes/config.js';
import { healthRoutes } from './routes/health.js';
import path from 'node:path';

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: { error: 'Muitas requisições, tente novamente mais tarde' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

app.use(auditMiddleware);

app.get('/api/health', healthRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/clients', authMiddleware, clientRoutes);
app.use('/api/consultations', authMiddleware, consultationRoutes);
app.use('/api/partners', authMiddleware, partnerRoutes);
app.use('/api/config', authMiddleware, configRoutes);

const frontendDist = path.resolve(process.cwd(), '../frontend/dist');
app.use(express.static(frontendDist));
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'Rota não encontrada' });
    return;
  }
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.use(errorHandler);

const PORT = parseInt(process.env.PORT || '3001');
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT} (${process.env.NODE_ENV})`);
});

export default app;