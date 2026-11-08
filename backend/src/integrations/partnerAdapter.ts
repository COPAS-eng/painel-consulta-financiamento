export interface PartnerConfig {
  id: string;
  name: string;
  displayName: string;
  baseUrl: string;
  authType: 'none' | 'api_key' | 'oauth2' | 'basic' | 'bearer';
  credentials: Record<string, unknown>;
  isActive: boolean;
  isTestEnv: boolean;
  rateLimit: number;
  requiredFields: string[];
}

export interface ConsultationRequest {
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

export interface ConsultationResponse {
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

export interface PartnerAdapter {
  readonly name: string;
  readonly displayName: string;
  readonly requiredFields: string[];
  readonly isConfigured: boolean;
  readonly isTestEnvironment: boolean;

  validateConfig(): Promise<{ valid: boolean; errors: string[] }>;
  buildRequest(request: ConsultationRequest): Promise<{ url: string; headers: Record<string, string>; body: unknown }>;
  sendRequest(request: ConsultationRequest): Promise<ConsultationResponse>;
  parseResponse(response: unknown): ConsultationResponse;
  handleError(error: unknown): ConsultationResponse;
}

export abstract class BasePartnerAdapter implements PartnerAdapter {
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract readonly requiredFields: string[];

  protected config: PartnerConfig;
  protected isTestEnv: boolean;

  constructor(config: PartnerConfig) {
    this.config = config;
    this.isTestEnv = config.isTestEnv;
  }

  get isConfigured(): boolean {
    return this.config.isActive && this.validateCredentials();
  }

  get isTestEnvironment(): boolean {
    return this.isTestEnv;
  }

  protected abstract validateCredentials(): boolean;

  abstract validateConfig(): Promise<{ valid: boolean; errors: string[] }>;
  abstract buildRequest(request: ConsultationRequest): Promise<{ url: string; headers: Record<string, string>; body: unknown }>;
  abstract sendRequest(request: ConsultationRequest): Promise<ConsultationResponse>;
  abstract parseResponse(response: unknown): ConsultationResponse;

  handleError(error: unknown): ConsultationResponse {
    const timestamp = new Date().toISOString();

    if (error instanceof Response) {
      return {
        success: false,
        status: 'error',
        errors: [{ code: 'HTTP_ERROR', message: `Erro HTTP: ${error.status} ${error.statusText}` }],
        timestamp,
      };
    }

    if (error instanceof Error) {
      return {
        success: false,
        status: 'error',
        errors: [{ code: 'REQUEST_ERROR', message: error.message }],
        timestamp,
      };
    }

    return {
      success: false,
      status: 'error',
      errors: [{ code: 'UNKNOWN_ERROR', message: 'Erro desconhecido ao consultar parceiro' }],
      timestamp,
    };
  }

  protected async makeRequest(
    url: string,
    options: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  protected formatCPF(cpf: string): string {
    return cpf.replace(/\D/g, '');
  }

  protected formatPhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  protected formatCurrency(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }

  protected formatDateBR(date: string | Date): string {
    const d = new Date(date);
    return d.toLocaleDateString('pt-BR');
  }
}

export class PartnerAdapterRegistry {
  private adapters: Map<string, PartnerAdapter> = new Map();
  private defaultAdapter: PartnerAdapter | null = null;

  register(adapter: PartnerAdapter): void {
    this.adapters.set(adapter.name, adapter);
    if (!this.defaultAdapter && adapter.isConfigured) {
      this.defaultAdapter = adapter;
    }
  }

  unregister(name: string): void {
    this.adapters.delete(name);
    if (this.defaultAdapter?.name === name) {
      this.defaultAdapter = null;
    }
  }

  get(name: string): PartnerAdapter | undefined {
    return this.adapters.get(name);
  }

  getDefault(): PartnerAdapter | null {
    return this.defaultAdapter;
  }

  getAll(): PartnerAdapter[] {
    return Array.from(this.adapters.values());
  }

  getActive(): PartnerAdapter[] {
    return this.getAll().filter(a => a.isConfigured);
  }

  setDefault(name: string): boolean {
    const adapter = this.adapters.get(name);
    if (adapter && adapter.isConfigured) {
      this.defaultAdapter = adapter;
      return true;
    }
    return false;
  }
}

export const partnerRegistry = new PartnerAdapterRegistry();