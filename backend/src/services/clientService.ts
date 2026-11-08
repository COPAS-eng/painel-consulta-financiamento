import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { encrypt, decrypt, maskCPF, maskRG, maskPhone, maskEmail } from '../lib/encryption.js';

export interface CreateClientInput {
  fullName: string;
  cpf: string;
  birthDate: string;
  rg?: string;
  email?: string;
  phone?: string;
  monthlyIncome?: number;
  profession?: string;
  maritalStatus?: string;
  address?: Record<string, unknown>;
  createdById: string;
}

export interface UpdateClientInput extends Partial<CreateClientInput> {
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
}

export interface ClientFilters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class ClientService {
  async create(input: CreateClientInput) {
    const existing = await prisma.client.findUnique({ where: { cpf: input.cpf } });
    if (existing) {
      throw new Error('CPF já cadastrado');
    }

    const client = await prisma.client.create({
      data: {
        fullName: input.fullName,
        cpf: input.cpf,
        birthDate: new Date(input.birthDate),
        rg: input.rg,
        email: input.email,
        phone: input.phone,
        monthlyIncome: input.monthlyIncome,
        profession: input.profession,
        maritalStatus: input.maritalStatus,
        address: input.address as Prisma.InputJsonValue,
        createdById: input.createdById,
      },
    });

    await this.logAudit(input.createdById, 'CLIENT_CREATED', 'client', client.id, null, {
      fullName: client.fullName,
      cpf: maskCPF(client.cpf),
    } as Prisma.InputJsonValue);

    return this.maskSensitiveData(client);
  }

  async update(id: string, input: UpdateClientInput, userId: string) {
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw new Error('Cliente não encontrado');
    }

    if (input.cpf && input.cpf !== client.cpf) {
      const existing = await prisma.client.findUnique({ where: { cpf: input.cpf } });
      if (existing) {
        throw new Error('CPF já cadastrado para outro cliente');
      }
    }

    const oldData = { ...client };

    const updated = await prisma.client.update({
      where: { id },
      data: {
        fullName: input.fullName,
        cpf: input.cpf,
        birthDate: input.birthDate ? new Date(input.birthDate) : undefined,
        rg: input.rg,
        email: input.email,
        phone: input.phone,
        monthlyIncome: input.monthlyIncome,
        profession: input.profession,
        maritalStatus: input.maritalStatus,
        address: input.address as Prisma.InputJsonValue,
        status: input.status,
      },
    });

    await this.logAudit(userId, 'CLIENT_UPDATED', 'client', id, oldData as Prisma.InputJsonValue, {
      fullName: updated.fullName,
      cpf: maskCPF(updated.cpf),
    } as Prisma.InputJsonValue);

    return this.maskSensitiveData(updated);
  }

  async getById(id: string, userId: string, userRole: string, includeSensitive = false) {
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        consents: { orderBy: { givenAt: 'desc' }, take: 5 },
        consultations: { orderBy: { startedAt: 'desc' }, take: 10 },
      },
    });

    if (!client) return null;

    if (userRole !== 'ADMIN' && client.createdById !== userId) {
      const hasConsultation = await prisma.consultation.findFirst({
        where: { clientId: id, requestedById: userId },
      });
      if (!hasConsultation) return null;
    }

    return includeSensitive ? client : this.maskSensitiveData(client);
  }

  async list(filters: ClientFilters, userId: string, userRole: string) {
    const where: Record<string, unknown> = {};

    if (filters.search) {
      where.OR = [
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { cpf: { contains: filters.search.replace(/\D/g, '') } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.status) where.status = filters.status;

    if (userRole !== 'ADMIN') {
      where.createdById = userId;
    }

    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: {
          createdBy: { select: { id: true, fullName: true } },
          _count: { select: { consultations: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.client.count({ where }),
    ]);

    return {
      data: clients.map(c => this.maskSensitiveData(c)),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async delete(id: string, userId: string, userRole: string) {
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      throw new Error('Cliente não encontrado');
    }

    if (userRole !== 'ADMIN' && client.createdById !== userId) {
      throw new Error('Sem permissão para excluir este cliente');
    }

    const hasConsultations = await prisma.consultation.count({ where: { clientId: id } });
    if (hasConsultations > 0) {
      await prisma.client.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });
      await this.logAudit(userId, 'CLIENT_ARCHIVED', 'client', id, { status: client.status } as Prisma.InputJsonValue, { status: 'ARCHIVED' } as Prisma.InputJsonValue);
      return { archived: true };
    }

    await prisma.client.delete({ where: { id } });
    await this.logAudit(userId, 'CLIENT_DELETED', 'client', id, { fullName: client.fullName } as Prisma.InputJsonValue, null);
    return { deleted: true };
  }

  async getConsents(clientId: string) {
    return prisma.consent.findMany({
      where: { clientId },
      orderBy: { givenAt: 'desc' },
    });
  }

  async createConsent(clientId: string, data: {
    purpose: string;
    partnerName: string;
    partnerEndpoint: string;
    dataFields: string[];
    expiresAt?: Date;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const existingActive = await prisma.consent.findFirst({
      where: { clientId, partnerName: data.partnerName, status: 'GIVEN' },
    });

    if (existingActive) {
      await prisma.consent.update({
        where: { id: existingActive.id },
        data: { status: 'REVOKED', revokedAt: new Date() },
      });
    }

    return prisma.consent.create({
      data: { clientId, ...data, status: 'GIVEN' },
    });
  }

  async revokeConsent(consentId: string, userId: string) {
    const consent = await prisma.consent.findUnique({ where: { id: consentId } });
    if (!consent) throw new Error('Consentimento não encontrado');

    await prisma.consent.update({
      where: { id: consentId },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });

    await this.logAudit(userId, 'CONSENT_REVOKED', 'consent', consentId, { status: 'GIVEN' } as Prisma.InputJsonValue, { status: 'REVOKED' } as Prisma.InputJsonValue);
    return { revoked: true };
  }

  private maskSensitiveData(client: {
    cpf: string;
    rg: string | null;
    phone: string | null;
    email: string | null;
    [key: string]: unknown;
  }) {
    return {
      ...client,
      cpf: maskCPF(client.cpf),
      rg: client.rg ? maskRG(client.rg) : null,
      phone: client.phone ? maskPhone(client.phone) : null,
      email: client.email ? maskEmail(client.email) : null,
    };
  }

  private async logAudit(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    oldData: unknown,
    newData: unknown
  ) {
    await prisma.auditLog.create({
      data: { userId, action, entityType, entityId, oldData: oldData as Prisma.InputJsonValue, newData: newData as Prisma.InputJsonValue },
    });
  }
}

export const clientService = new ClientService();