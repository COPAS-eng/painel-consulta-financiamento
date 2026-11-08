import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { encrypt } from '../lib/encryption.js';
import { AppError } from '../middleware/errorHandler.js';

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  role?: 'ADMIN' | 'BROKER' | 'VIEWER';
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiresIn: string;
  private readonly refreshExpiresIn: string;

  constructor() {
    this.accessSecret = process.env.JWT_SECRET!;
    this.refreshSecret = process.env.JWT_REFRESH_SECRET!;
    this.accessExpiresIn = process.env.JWT_EXPIRES_IN || '8h';
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

    if (!this.accessSecret || this.accessSecret.length < 32) {
      throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres');
    }
    if (!this.refreshSecret || this.refreshSecret.length < 32) {
      throw new Error('JWT_REFRESH_SECRET deve ter pelo menos 32 caracteres');
    }
  }

  async register(input: RegisterInput, requestedById?: string) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new Error('E-mail já cadastrado');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        role: input.role || 'BROKER',
        status: 'PENDING',
      },
    });

    if (requestedById) {
      await this.logAudit(requestedById, 'USER_CREATED', 'user', user.id, null, {
        email: user.email,
        role: user.role,
      } as Prisma.InputJsonValue);
    }

    return this.generateTokens(user);
  }

  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new AppError('Credenciais inválidas', 401, 'INVALID_CREDENTIALS');
    }

    if (user.status !== 'ACTIVE') {
      throw new Error('Conta não está ativa. Aguarde aprovação do administrador.');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      throw new AppError('Credenciais inválidas', 401, 'INVALID_CREDENTIALS');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.logAudit(user.id, 'USER_LOGIN', 'user', user.id, null, { email: user.email } as Prisma.InputJsonValue);

    return this.generateTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: TokenPayload;
    try {
      payload = jwt.verify(refreshToken, this.refreshSecret) as TokenPayload;
    } catch {
      throw new Error('Token de atualização inválido ou expirado');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'ACTIVE') {
      throw new Error('Usuário não encontrado ou inativo');
    }

    return this.generateTokens(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('Usuário não encontrado');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new Error('Senha atual incorreta');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    await this.logAudit(userId, 'PASSWORD_CHANGED', 'user', userId, null, null);
    return { success: true };
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, role: true, status: true, lastLoginAt: true, createdAt: true },
    });
    if (!user) throw new Error('Usuário não encontrado');
    return user;
  }

  async updateProfile(userId: string, data: { fullName?: string; email?: string }) {
    if (data.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing && existing.id !== userId) {
        throw new Error('E-mail já está em uso');
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { fullName: data.fullName, email: data.email },
      select: { id: true, email: true, fullName: true, role: true, status: true },
    });

    await this.logAudit(userId, 'PROFILE_UPDATED', 'user', userId, null, data as Prisma.InputJsonValue);
    return user;
  }

  async listUsers(requesterId: string, requesterRole: string) {
    if (requesterRole !== 'ADMIN') {
      throw new Error('Sem permissão');
    }

    return prisma.user.findMany({
      select: { id: true, email: true, fullName: true, role: true, status: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateUserStatus(userId: string, status: 'ACTIVE' | 'INACTIVE' | 'PENDING', requesterId: string, requesterRole: string) {
    if (requesterRole !== 'ADMIN') throw new Error('Sem permissão');
    if (userId === requesterId) throw new Error('Não pode alterar próprio status');

    const user = await prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, email: true, fullName: true, role: true, status: true },
    });

    await this.logAudit(requesterId, 'USER_STATUS_UPDATED', 'user', userId, null, { status } as Prisma.InputJsonValue);
    return user;
  }

  async updateUserRole(userId: string, role: 'ADMIN' | 'BROKER' | 'VIEWER', requesterId: string, requesterRole: string) {
    if (requesterRole !== 'ADMIN') throw new Error('Sem permissão');
    if (userId === requesterId) throw new Error('Não pode alterar própria role');

    const user = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, email: true, fullName: true, role: true, status: true },
    });

    await this.logAudit(requesterId, 'USER_ROLE_UPDATED', 'user', userId, null, { role } as Prisma.InputJsonValue);
    return user;
  }

  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, this.accessSecret) as TokenPayload;
  }

  verifyRefreshToken(token: string): TokenPayload {
    return jwt.verify(token, this.refreshSecret) as TokenPayload;
  }

  private generateTokens(user: { id: string; email: string; role: string }): AuthTokens {
    const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, this.accessSecret, { expiresIn: this.accessExpiresIn as jwt.SignOptions['expiresIn'] });
    const refreshToken = jwt.sign(payload, this.refreshSecret, { expiresIn: this.refreshExpiresIn as jwt.SignOptions['expiresIn'] });

    const decoded = jwt.decode(accessToken) as TokenPayload;
    const expiresIn = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 28800;

    return { accessToken, refreshToken, expiresIn, tokenType: 'Bearer' };
  }

  private async logAudit(userId: string, action: string, entityType: string, entityId: string, oldData: unknown, newData: unknown) {
    await prisma.auditLog.create({
      data: { userId, action, entityType, entityId, oldData: oldData as Prisma.InputJsonValue, newData: newData as Prisma.InputJsonValue },
    });
  }
}

export const authService = new AuthService();