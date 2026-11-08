import { prisma } from '../lib/prisma.js';
import { partnerRegistry } from '../integrations/index.js';
import {
  ConsultationRequest,
  ConsultationResponse,
  PartnerAdapter
} from '../integrations/partnerAdapter.js';
import { Prisma } from '@prisma/client';
import { encrypt, decrypt } from '../lib/encryption.js';

export interface CreateConsultationInput {
  clientId: string;
  partnerId: string;
  requestedById: string;
  financingData: {
    propertyValue: number;
    downPayment: number;
    termMonths: number;
    interestRate?: number;
  };
  consentId: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ConsultationResult {
  consultation: {
    id: string;
    status: string;
    externalId: string | null;
    startedAt: Date;
    completedAt: Date | null;
    errorCode: string | null;
    errorMessage: string | null;
    partnerName: string;
  };
  response: ConsultationResponse | null;
}

export class ConsultationService {
  async createAndExecute(input: CreateConsultationInput): Promise<ConsultationResult> {
    const client = await prisma.client.findUnique({
      where: { id: input.clientId },
      include: { consents: { where: { id: input.consentId } } },
    });

    if (!client) {
      throw new Error('Cliente não encontrado');
    }

    const consent = client.consents[0];
    if (!consent || consent.status !== 'GIVEN') {
      throw new Error('Consentimento inválido ou revogado');
    }

    if (consent.expiresAt && new Date() > consent.expiresAt) {
      throw new Error('Consentimento expirado');
    }

    const partnerConfig = await prisma.partnerConfig.findUnique({
      where: { id: input.partnerId },
    });

    if (!partnerConfig || !partnerConfig.isActive) {
      throw new Error('Parceiro não configurado ou inativo');
    }

    const adapter = partnerRegistry.get(partnerConfig.name);
    if (!adapter) {
      throw new Error(`Adaptador não encontrado para parceiro: ${partnerConfig.name}`);
    }

    if (!adapter.isConfigured) {
      throw new Error(`Parceiro ${partnerConfig.displayName} não está configurado para uso em produção`);
    }

    const validation = await adapter.validateConfig();
    if (!validation.valid) {
      throw new Error(`Configuração do parceiro inválida: ${validation.errors.join(', ')}`);
    }

    const missingFields = partnerConfig.requiredFields.filter(
      field => !this.hasField(client, field) && !this.hasField(input.financingData, field)
    );

    if (missingFields.length > 0) {
      throw new Error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
    }

    const loanAmount = input.financingData.propertyValue - input.financingData.downPayment;

    const requestPayload = {
          clientData: this.sanitizeClientData(client),
          financingData: {
            ...input.financingData,
            loanAmount,
          },
          metadata: {
            partnerId: partnerConfig.id,
            requestedBy: input.requestedById,
            consentId: input.consentId,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          },
        };

    const consultation = await prisma.consultation.create({
      data: {
        clientId: input.clientId,
        requestedById: input.requestedById,
        partnerName: partnerConfig.name,
        partnerEndpoint: partnerConfig.baseUrl,
        requestPayload: requestPayload as Prisma.InputJsonValue,
        status: 'PROCESSING',
      },
    });

    await this.logAudit(input.requestedById, 'CONSULTATION_CREATED', 'consultation', consultation.id, null, {
      clientId: input.clientId,
      partnerId: input.partnerId,
    } as Prisma.InputJsonValue);

    try {
      const request: ConsultationRequest = {
        clientData: this.sanitizeClientData(client),
        financingData: {
          ...input.financingData,
          loanAmount,
        },
        metadata: {
          partnerId: partnerConfig.id,
          requestedBy: input.requestedById,
          consentId: input.consentId,
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      } as ConsultationRequest;

      const response = await adapter.sendRequest(request);

      const updated = await prisma.consultation.update({
        where: { id: consultation.id },
        data: {
          responsePayload: response as unknown as Prisma.InputJsonValue,
          status: this.mapResponseStatus(response.status) as 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'UNAVAILABLE' | 'EXPIRED',
          externalId: response.externalId || null,
          errorCode: response.errors?.[0]?.code || null,
          errorMessage: response.errors?.[0]?.message || null,
          completedAt: new Date(),
        },
      });

      await this.logAudit(input.requestedById, 'CONSULTATION_COMPLETED', 'consultation', consultation.id, {
        status: 'PROCESSING' as const,
      } as Prisma.InputJsonValue, {
        status: updated.status,
        externalId: updated.externalId,
      } as Prisma.InputJsonValue);

      return {
        consultation: {
          id: updated.id,
          status: updated.status,
          externalId: updated.externalId,
          startedAt: updated.startedAt,
          completedAt: updated.completedAt,
          errorCode: updated.errorCode,
          errorMessage: updated.errorMessage,
          partnerName: updated.partnerName,
        },
        response,
      };
    } catch (error) {
      const errorResponse = adapter.handleError(error);

      await prisma.consultation.update({
        where: { id: consultation.id },
        data: {
          responsePayload: errorResponse as unknown as Prisma.InputJsonValue,
          status: 'FAILED',
          errorCode: errorResponse.errors?.[0]?.code || 'UNKNOWN_ERROR',
          errorMessage: errorResponse.errors?.[0]?.message || 'Erro desconhecido',
          completedAt: new Date(),
        },
      });

      await this.logAudit(input.requestedById, 'CONSULTATION_FAILED', 'consultation', consultation.id, {
        status: 'PROCESSING' as const,
      } as Prisma.InputJsonValue, {
        status: 'FAILED' as const,
        error: errorResponse.errors?.[0]?.message,
      } as Prisma.InputJsonValue);

      return {
        consultation: {
          id: consultation.id,
          status: 'FAILED',
          externalId: null,
          startedAt: consultation.startedAt,
          completedAt: new Date(),
          errorCode: errorResponse.errors?.[0]?.code || 'UNKNOWN_ERROR',
          errorMessage: errorResponse.errors?.[0]?.message || 'Erro desconhecido',
          partnerName: consultation.partnerName,
        },
        response: errorResponse,
      };
    }
  }

  async getById(id: string, userId: string, userRole: string) {
    const consultation = await prisma.consultation.findUnique({
      where: { id },
      include: {
        client: true,
        requestedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    if (!consultation) {
      return null;
    }

    if (userRole !== 'ADMIN' && consultation.requestedById !== userId) {
      return null;
    }

    return {
      ...consultation,
      client: this.maskClientData(consultation.client),
    };
  }

  async getHistory(filters: {
    clientId?: string;
    requestedById?: string;
    status?: string;
    partnerName?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
    userId: string;
    userRole: string;
  }) {
    const where: Record<string, unknown> = {};

    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.status) where.status = filters.status;
    if (filters.partnerName) where.partnerName = filters.partnerName;
    if (filters.startDate || filters.endDate) {
      where.startedAt = {};
      if (filters.startDate) (where.startedAt as Record<string, Date>).gte = filters.startDate;
      if (filters.endDate) (where.startedAt as Record<string, Date>).lte = filters.endDate;
    }

    if (filters.userRole !== 'ADMIN') {
      where.requestedById = filters.userId;
    } else if (filters.requestedById) {
      where.requestedById = filters.requestedById;
    }

    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const [consultations, total] = await Promise.all([
      prisma.consultation.findMany({
        where,
        include: {
          client: { select: { id: true, fullName: true, cpf: true } },
          requestedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.consultation.count({ where }),
    ]);

    return {
      data: consultations.map(c => ({
        ...c,
        client: this.maskClientData(c.client),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStats(userId: string, userRole: string) {
    const where = userRole === 'ADMIN' ? {} : { requestedById: userId };

    const [total, byStatus, byPartner, recent] = await Promise.all([
      prisma.consultation.count({ where }),
      prisma.consultation.groupBy({ by: ['status'], where, _count: true }),
      prisma.consultation.groupBy({ by: ['partnerName'], where, _count: true }),
      prisma.consultation.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: 5,
        select: { id: true, status: true, partnerName: true, startedAt: true, clientId: true },
      }),
    ]);

    return {
      total,
      byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      byPartner: byPartner.reduce((acc, p) => ({ ...acc, [p.partnerName]: p._count }), {}),
      recent,
    };
  }

  private sanitizeClientData(client: {
    fullName: string;
    cpf: string;
    birthDate: Date;
    rg: string | null;
    email: string | null;
    phone: string | null;
    monthlyIncome: Prisma.Decimal | null;
    profession: string | null;
    maritalStatus: string | null;
    address: Prisma.JsonValue | null;
    [key: string]: unknown;
  }) {
    return {
      fullName: client.fullName,
      cpf: client.cpf,
      birthDate: client.birthDate.toISOString().split('T')[0],
      rg: client.rg,
      email: client.email,
      phone: client.phone,
      monthlyIncome: client.monthlyIncome ? Number(client.monthlyIncome) : undefined,
      profession: client.profession,
      maritalStatus: client.maritalStatus,
      address: (client.address as Record<string, unknown>) || undefined,
    };
  }

  private maskClientData(client: { id: string; fullName: string; cpf: string; rg?: string | null; [key: string]: unknown }) {
    return {
      ...client,
      cpf: this.maskCPF(client.cpf),
      rg: client.rg ? this.maskRG(client.rg) : null,
    };
  }

  private maskCPF(cpf: string): string {
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length !== 11) return cpf;
    return `${cleaned.slice(0, 3)}.***.***-${cleaned.slice(9)}`;
  }

  private maskRG(rg: string): string {
    const cleaned = rg.replace(/\D/g, '');
    if (cleaned.length < 4) return rg;
    return `${cleaned.slice(0, 2)}.***.***-${cleaned.slice(-1)}`;
  }

  private hasField(obj: Record<string, unknown>, field: string): boolean {
    return field in obj && obj[field] !== null && obj[field] !== undefined && obj[field] !== '';
  }

  private mapResponseStatus(status: ConsultationResponse['status']): string {
    const map: Record<ConsultationResponse['status'], string> = {
      approved: 'COMPLETED',
      denied: 'COMPLETED',
      pending: 'PROCESSING',
      requires_review: 'PROCESSING',
      error: 'FAILED',
    };
    return map[status] || 'FAILED';
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

export const consultationService = new ConsultationService();