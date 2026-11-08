export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'BROKER' | 'VIEWER';
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  lastLoginAt: string | null;
  createdAt: string;
}

export interface Client {
  id: string;
  fullName: string;
  cpf: string;
  rg: string | null;
  birthDate: string;
  email: string | null;
  phone: string | null;
  monthlyIncome: number | null;
  profession: string | null;
  maritalStatus: string | null;
  address: Record<string, unknown> | null;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; fullName: string };
  _count?: { consultations: number };
  consents?: Consent[];
}

export interface ClientFormData {
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
}

export interface Consent {
  id: string;
  clientId: string;
  purpose: string;
  partnerName: string;
  partnerEndpoint: string;
  dataFields: string[];
  ipAddress: string | null;
  userAgent: string | null;
  status: 'GIVEN' | 'REVOKED' | 'EXPIRED';
  givenAt: string;
  revokedAt: string | null;
  expiresAt: string | null;
}

export interface Consultation {
  id: string;
  clientId: string;
  requestedById: string;
  partnerName: string;
  partnerEndpoint: string;
  requestPayload: ConsultationRequestPayload;
  responsePayload: ConsultationResponsePayload | null;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'UNAVAILABLE' | 'EXPIRED';
  externalId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  expiresAt: string | null;
  client?: Pick<Client, 'id' | 'fullName' | 'cpf'>;
  requestedBy?: { id: string; fullName: string; email: string };
}

export interface ConsultationRequestPayload {
  clientData: {
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
  };
  financingData: {
    propertyValue: number;
    downPayment: number;
    loanAmount: number;
    termMonths: number;
    interestRate?: number;
  };
  metadata: {
    partnerId: string;
    requestedBy: string;
    consentId: string;
    ipAddress?: string;
    userAgent?: string;
  };
}

export interface ConsultationResponsePayload {
  success: boolean;
  externalId?: string;
  status: 'approved' | 'denied' | 'pending' | 'requires_review' | 'error';
  data?: {
    approvedAmount?: number;
    interestRate?: number;
    termMonths?: number;
    monthlyPayment?: number;
    totalAmount?: number;
    conditions?: string[];
    restrictions?: string[];
    validUntil?: string;
    [key: string]: unknown;
  };
  errors?: Array<{ code: string; message: string; field?: string }>;
  rawResponse?: unknown;
  timestamp: string;
}

export interface Partner {
  id: string;
  name: string;
  displayName: string;
  baseUrl: string;
  authType: string;
  isActive: boolean;
  isTestEnv: boolean;
  rateLimit: number;
  requiredFields: string[];
  createdAt: string;
  updatedAt: string;
  isConfigured?: boolean;
  isTestEnvironment?: boolean;
}

export interface ConsultationFilters {
  clientId?: string;
  requestedById?: string;
  status?: string;
  partnerName?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface ClientFilters {
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ConsultationStats {
  total: number;
  byStatus: Record<string, number>;
  byPartner: Record<string, number>;
  recent: Array<{
    id: string;
    status: string;
    partnerName: string;
    startedAt: string;
    clientId: string;
  }>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  role?: 'ADMIN' | 'BROKER' | 'VIEWER';
}

export interface FinancingFormData {
  propertyValue: number;
  downPayment: number;
  termMonths: number;
  interestRate?: number;
}