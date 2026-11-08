import {
  PartnerAdapter,
  PartnerConfig,
  ConsultationRequest,
  ConsultationResponse,
  BasePartnerAdapter
} from './partnerAdapter.js';

export interface BankPartnerCredentials {
  clientId: string;
  clientSecret: string;
  certificate?: string;
  certificateKey?: string;
  apiKey?: string;
}

export abstract class BankPartnerAdapter extends BasePartnerAdapter {
  protected credentials: BankPartnerCredentials;
  protected accessToken: string | null = null;
  protected tokenExpiresAt: number = 0;

  constructor(config: PartnerConfig) {
    super(config);
    this.credentials = config.credentials as unknown as BankPartnerCredentials;
  }

  protected validateCredentials(): boolean {
    return !!(
      this.credentials.clientId &&
      this.credentials.clientSecret &&
      this.config.baseUrl
    );
  }

  abstract getAuthUrl(): string;
  abstract getConsultationEndpoint(): string;

  async validateConfig(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!this.config.isActive) {
      errors.push('Parceiro não está ativo');
    }

    if (!this.config.baseUrl) {
      errors.push('URL base não configurada');
    }

    if (!this.credentials.clientId) {
      errors.push('Client ID não configurado');
    }

    if (!this.credentials.clientSecret) {
      errors.push('Client Secret não configurado');
    }

    if (this.config.authType === 'oauth2' && !this.getAuthUrl()) {
      errors.push('URL de autenticação OAuth2 não definida');
    }

    return { valid: errors.length === 0, errors };
  }

  async buildRequest(request: ConsultationRequest): Promise<{ url: string; headers: Record<string, string>; body: unknown }> {
    await this.ensureValidToken();

    return {
      url: `${this.config.baseUrl}${this.getConsultationEndpoint()}`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
        'X-Request-ID': `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      },
      body: this.transformToBankFormat(request),
    };
  }

  async sendRequest(request: ConsultationRequest): Promise<ConsultationResponse> {
    const { url, headers, body } = await this.buildRequest(request);

    try {
      const response = await this.makeRequest(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        return this.handleHttpError(response, responseData);
      }

      return this.parseResponse(responseData);
    } catch (error) {
      return this.handleError(error);
    }
  }

  protected abstract transformToBankFormat(request: ConsultationRequest): Record<string, unknown>;
  abstract parseResponse(response: unknown): ConsultationResponse;

  protected async ensureValidToken(): Promise<void> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return;
    }

    await this.refreshToken();
  }

  protected abstract refreshToken(): Promise<void>;

  protected handleHttpError(response: Response, data: unknown): ConsultationResponse {
    return {
      success: false,
      status: 'error',
      errors: [{
        code: `HTTP_${response.status}`,
        message: typeof data === 'object' && data !== null && 'message' in data
          ? String((data as Record<string, unknown>).message)
          : `Erro na API do parceiro: ${response.status}`,
      }],
      rawResponse: data,
      timestamp: new Date().toISOString(),
    };
  }
}

export class ExampleBankAdapter extends BankPartnerAdapter {
  readonly name = 'example_bank';
  readonly displayName = 'Banco Exemplo S.A.';
  readonly requiredFields = [
    'fullName', 'cpf', 'birthDate', 'rg',
    'monthlyIncome', 'propertyValue', 'downPayment',
    'termMonths', 'interestRate'
  ];

  getAuthUrl(): string {
    return `${this.config.baseUrl}/oauth/token`;
  }

  getConsultationEndpoint(): string {
    return '/api/v2/credit-analysis';
  }

  protected async refreshToken(): Promise<void> {
    const response = await this.makeRequest(this.getAuthUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(
          `${this.credentials.clientId}:${this.credentials.clientSecret}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'credit_analysis',
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Falha na autenticação: ${response.status}`);
    }

    const data = await response.json() as { access_token: string; expires_in?: number };
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  }

  protected transformToBankFormat(request: ConsultationRequest): Record<string, unknown> {
    const { clientData, financingData, metadata } = request;

    return {
      solicitante: {
        nome: clientData.fullName,
        cpf: this.formatCPF(clientData.cpf),
        data_nascimento: clientData.birthDate.split('T')[0],
        rg: clientData.rg,
        renda_mensal: clientData.monthlyIncome,
        telefone: clientData.phone ? this.formatPhone(clientData.phone) : undefined,
        email: clientData.email,
      },
      proposta: {
        valor_imovel: financingData.propertyValue,
        valor_entrada: financingData.downPayment,
        valor_solicitado: financingData.loanAmount,
        prazo: financingData.termMonths,
        taxa_nominal_anual: financingData.interestRate || 0.0999,
        sistema_amortizacao: 'SAC',
      },
      metadados: {
        corretor_id: metadata.requestedBy,
        consentimento_id: metadata.consentId,
        ip_origem: metadata.ipAddress,
        user_agent: metadata.userAgent,
      },
    };
  }

  parseResponse(response: unknown): ConsultationResponse {
    if (!response || typeof response !== 'object') {
      return this.handleError(new Error('Resposta inválida'));
    }

    const data = response as Record<string, unknown>;

    return {
      success: true,
      externalId: data.id_solicitacao as string,
      status: this.mapStatus(data.status as string),
      data: {
        approvedAmount: data.valor_aprovado as number,
        interestRate: data.taxa_efetiva_anual as number,
        termMonths: data.prazo_aprovado as number,
        monthlyPayment: data.valor_parcela as number,
        totalAmount: data.valor_total as number,
        conditions: (data.condicoes as string[]) || [],
        restrictions: (data.restricoes as string[]) || [],
        validUntil: data.validade as string,
      },
      rawResponse: response,
      timestamp: new Date().toISOString(),
    };
  }

  private mapStatus(status: string): ConsultationResponse['status'] {
    const statusMap: Record<string, ConsultationResponse['status']> = {
      'APROVADO': 'approved',
      'NEGADO': 'denied',
      'EM_ANALISE': 'pending',
      'PENDENTE_DOCUMENTOS': 'requires_review',
      'ERRO': 'error',
    };
    return statusMap[status?.toUpperCase()] || 'error';
  }
}