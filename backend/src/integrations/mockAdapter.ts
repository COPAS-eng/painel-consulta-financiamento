import {
  PartnerAdapter,
  PartnerConfig,
  ConsultationRequest,
  ConsultationResponse,
  BasePartnerAdapter
} from './partnerAdapter.js';

export class MockPartnerAdapter extends BasePartnerAdapter {
  readonly name = 'mock';
  readonly displayName = 'Parceiro de Teste (Simulado)';
  readonly requiredFields = ['fullName', 'cpf', 'birthDate', 'monthlyIncome', 'propertyValue', 'downPayment'];

  constructor(config: PartnerConfig) {
    super({ ...config, isTestEnv: true });
  }

  protected validateCredentials(): boolean {
    return true;
  }

  async validateConfig(): Promise<{ valid: boolean; errors: string[] }> {
    return { valid: true, errors: [] };
  }

  async buildRequest(request: ConsultationRequest): Promise<{ url: string; headers: Record<string, string>; body: unknown }> {
    return {
      url: `${this.config.baseUrl}/api/v1/consultation`,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: this.transformRequest(request),
    };
  }

  async sendRequest(request: ConsultationRequest): Promise<ConsultationResponse> {
    await new Promise(resolve => setTimeout(resolve, 1500));

    const { clientData, financingData } = request;
    const loanAmount = financingData.propertyValue - financingData.downPayment;
    const monthlyIncome = clientData.monthlyIncome || 0;
    const maxPayment = monthlyIncome * 0.3;
    const termMonths = financingData.termMonths;
    const interestRate = financingData.interestRate || 0.09;

    const monthlyRate = interestRate / 12;
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
                          (Math.pow(1 + monthlyRate, termMonths) - 1);

    const approved = monthlyPayment <= maxPayment;
    const approvedAmount = approved ? loanAmount : Math.floor(maxPayment *
      (Math.pow(1 + monthlyRate, termMonths) - 1) / (monthlyRate * Math.pow(1 + monthlyRate, termMonths)));

    const externalId = `MOCK-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    return {
      success: true,
      externalId,
      status: approved ? 'approved' : 'denied',
      data: {
        approvedAmount,
        interestRate,
        termMonths,
        monthlyPayment: approved ? monthlyPayment : Math.round(maxPayment * 100) / 100,
        totalAmount: approved ? monthlyPayment * termMonths : maxPayment * termMonths,
        conditions: approved
          ? ['Seguro de vida obrigatório', 'Seguro do imóvel obrigatório', 'Taxa de administração mensal']
          : [],
        restrictions: approved
          ? []
          : ['Renda insuficiente para o valor solicitado', 'Considere aumentar a entrada ou reduzir o valor do imóvel'],
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  parseResponse(response: unknown): ConsultationResponse {
    if (response && typeof response === 'object' && 'success' in response) {
      return response as ConsultationResponse;
    }
    return this.handleError(new Error('Resposta inválida do parceiro'));
  }

  private transformRequest(request: ConsultationRequest): Record<string, unknown> {
    return {
      cliente: {
        nome_completo: request.clientData.fullName,
        cpf: this.formatCPF(request.clientData.cpf),
        data_nascimento: request.clientData.birthDate,
        rg: request.clientData.rg,
        email: request.clientData.email,
        telefone: request.clientData.phone ? this.formatPhone(request.clientData.phone) : undefined,
        renda_mensal: request.clientData.monthlyIncome,
        profissao: request.clientData.profession,
        estado_civil: request.clientData.maritalStatus,
        endereco: request.clientData.address,
      },
      financiamento: {
        valor_imovel: request.financingData.propertyValue,
        valor_entrada: request.financingData.downPayment,
        valor_financiado: request.financingData.loanAmount,
        prazo_meses: request.financingData.termMonths,
        taxa_juros_anual: request.financingData.interestRate,
      },
      metadados: request.metadata,
    };
  }
}