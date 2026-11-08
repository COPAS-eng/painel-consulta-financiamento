import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Client, Partner, Consent } from '../types';
import { formatCurrency, formatDate, formatDateTime, maskCPF, maskRG } from '../utils/formatters';
import { Button, Input, Select, Alert } from '../components';
import toast from 'react-hot-toast';

const financingSchema = z.object({
  clientId: z.string().uuid('Selecione um cliente'),
  partnerId: z.string().uuid('Selecione um parceiro'),
  consentId: z.string().uuid('Selecione um consentimento válido'),
  propertyValue: z.number().min(1000, 'Valor do imóvel deve ser maior que R$ 1.000'),
  downPayment: z.number().min(0, 'Entrada não pode ser negativa'),
  termMonths: z.number().int().min(1).max(480, 'Prazo deve ser entre 1 e 480 meses'),
  interestRate: z.number().min(0).max(1).optional(),
});

type FinancingFormValues = z.infer<typeof financingSchema>;

const STEPS = [
  { id: 'client', label: '1. Cliente' },
  { id: 'consent', label: '2. Consentimento' },
  { id: 'financing', label: '3. Financiamento' },
  { id: 'confirm', label: '4. Confirmar' },
];

export function NewConsultationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const initialClientId = searchParams.get('clientId') || '';

  const { register, handleSubmit: submitForm, watch, formState: { errors } } = useForm<FinancingFormValues>({
    resolver: zodResolver(financingSchema),
    mode: 'onChange',
    defaultValues: {
      clientId: initialClientId,
      termMonths: 360,
      interestRate: 9.99,
    },
  });

  const watchedClientId = watch('clientId');
  const watchedPartnerId = watch('partnerId');

  const { data: clients } = useQuery<Client[]>({
    queryKey: ['clients', 'all'],
    queryFn: async () => {
      const response = await api.get('/clients?limit=100&status=ACTIVE');
      return response.data.data;
    },
  });

  const { data: partners } = useQuery<Partner[]>({
    queryKey: ['partners', 'active'],
    queryFn: async () => {
      const response = await api.get('/partners/active');
      return response.data;
    },
  });

  const { data: consents } = useQuery<Consent[]>({
    queryKey: ['consents', watchedClientId, watchedPartnerId],
    queryFn: async () => {
      if (!watchedClientId) return [];
      const response = await api.get(`/clients/${watchedClientId}/consents`);
      return response.data.filter((c: Consent) =>
        c.status === 'GIVEN' && (!watchedPartnerId || c.partnerName === watchedPartnerId)
      );
    },
    enabled: !!watchedClientId,
  });

  const selectedClient = clients?.find(c => c.id === watchedClientId);
  const selectedPartner = partners?.find(p => p.id === watchedPartnerId);
  const selectedConsent = consents?.find(c => c.id === watch('consentId'));

  const createMutation = useMutation({
    mutationFn: (data: FinancingFormValues) => api.post('/consultations', data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      queryClient.invalidateQueries({ queryKey: ['consultationStats'] });
      toast.success('Consulta enviada com sucesso');
      navigate(`/consultations/${response.data.consultation.id}`);
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Erro ao criar consulta');
      toast.error('Erro ao criar consulta');
    },
  });

  const nextStep = () => {
    const step = STEPS[currentStep];
    let valid = true;

    if (step.id === 'client' && !watchedClientId) {
      setError('Selecione um cliente');
      valid = false;
    }
    if (step.id === 'consent' && !watch('consentId')) {
      setError('Selecione um consentimento válido');
      valid = false;
    }
    if (step.id === 'financing') {
      const propertyValue = watch('propertyValue');
      const downPayment = watch('downPayment');
      if (!propertyValue || propertyValue < 1000) {
        setError('Valor do imóvel deve ser maior que R$ 1.000');
        valid = false;
      }
      if (downPayment !== undefined && downPayment > propertyValue) {
        setError('Entrada não pode ser maior que o valor do imóvel');
        valid = false;
      }
    }

    if (valid) {
      setError('');
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const prevStep = () => {
    setError('');
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const onSubmitForm = async (data: FinancingFormValues) => {
    setIsSubmitting(true);
    try {
      // Convert interestRate from percentage to decimal (e.g., 9.99 -> 0.0999)
      const submitData = {
        ...data,
        interestRate: data.interestRate ? data.interestRate / 100 : undefined,
      };
      await createMutation.mutateAsync(submitData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (STEPS[currentStep].id) {
      case 'client':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Selecione o Cliente</h3>
            {error && <Alert variant="danger">{error}</Alert>}
            <Select
              label="Cliente *"
              options={clients?.map(c => ({ value: c.id, label: `${c.fullName} (${maskCPF(c.cpf)})` })) || []}
              placeholder="Selecione um cliente"
              error={errors.clientId?.message}
              {...register('clientId')}
            />
            {selectedClient && (
              <div className="card p-4 bg-gray-50">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div><dt className="text-gray-500">CPF</dt><dd className="font-medium">{maskCPF(selectedClient.cpf)}</dd></div>
                  <div><dt className="text-gray-500">Data Nasc.</dt><dd className="font-medium">{formatDate(selectedClient.birthDate)}</dd></div>
                  <div><dt className="text-gray-500">Renda</dt><dd className="font-medium">{formatCurrency(selectedClient.monthlyIncome)}</dd></div>
                  <div><dt className="text-gray-500">E-mail</dt><dd className="font-medium">{selectedClient.email || '—'}</dd></div>
                </dl>
              </div>
            )}
          </div>
        );
      case 'consent':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Selecione o Consentimento</h3>
            <p className="text-sm text-gray-500">
              O consentimento deve estar válido e corresponder ao parceiro selecionado.
              <Link to={`/clients/${watchedClientId}`} className="text-primary-600 hover:underline ml-1">
                Gerenciar consentimentos
              </Link>
            </p>
            {error && <Alert variant="danger">{error}</Alert>}

            <Select
              label="Parceiro *"
              options={partners?.map(p => ({ value: p.id, label: p.displayName })) || []}
              placeholder="Selecione um parceiro"
              error={errors.partnerId?.message}
              {...register('partnerId')}
            />

            {consents?.length === 0 ? (
              <Alert variant="warning">
                Nenhum consentimento válido encontrado para este cliente e parceiro.
                <Link to={`/clients/${watchedClientId}`} className="text-primary-600 hover:underline ml-1">
                  Crie um novo consentimento
                </Link>
              </Alert>
            ) : (
              <>
                <Select
                  label="Consentimento *"
                  options={consents?.map(c => ({ value: c.id, label: `${c.partnerName} - ${formatDateTime(c.givenAt)}` })) || []}
                  placeholder="Selecione um consentimento"
                  error={errors.consentId?.message}
                  {...register('consentId')}
                />
                {selectedConsent && (
                  <div className="card p-4 bg-gray-50">
                    <dl className="grid grid-cols-1 gap-2 text-sm">
                      <div><dt className="text-gray-500">Finalidade</dt><dd className="font-medium">{selectedConsent.purpose}</dd></div>
                      <div><dt className="text-gray-500">Parceiro</dt><dd className="font-medium">{selectedConsent.partnerName}</dd></div>
                      <div><dt className="text-gray-500">Campos</dt><dd className="font-medium">{selectedConsent.dataFields.join(', ')}</dd></div>
                      <div><dt className="text-gray-500">Concedido em</dt><dd className="font-medium">{formatDateTime(selectedConsent.givenAt)}</dd></div>
                      <div><dt className="text-gray-500">Expira em</dt><dd className="font-medium">{selectedConsent.expiresAt ? formatDateTime(selectedConsent.expiresAt) : 'Não expira'}</dd></div>
                    </dl>
                  </div>
                )}
              </>
            )}
          </div>
        );
      case 'financing':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Dados do Financiamento</h3>
            {error && <Alert variant="danger">{error}</Alert>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Valor do Imóvel (R$) *"
                type="number"
                step="0.01"
                min="1000"
                placeholder="0,00"
                error={errors.propertyValue?.message}
                {...register('propertyValue', { valueAsNumber: true })}
              />
              <Input
                label="Valor da Entrada (R$) *"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                error={errors.downPayment?.message}
                {...register('downPayment', { valueAsNumber: true })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Prazo (meses) *"
                type="number"
                min="1"
                max="480"
                error={errors.termMonths?.message}
                {...register('termMonths', { valueAsNumber: true })}
              />
              <Input
                label="Taxa de Juros Anual (%)"
                type="number"
                step="0.0001"
                min="0"
                max="100"
                placeholder="9,99"
                error={errors.interestRate?.message}
                {...register('interestRate', { valueAsNumber: true })}
              />
            </div>
            {selectedClient && watchedClientId && watchedPartnerId && (
              <div className="card p-4 bg-blue-50 border-blue-200">
                <h4 className="font-medium text-blue-800 mb-2">Dados que serão enviados</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Nome completo: {selectedClient.fullName}</li>
                  <li>• CPF: {maskCPF(selectedClient.cpf)}</li>
                  <li>• Data de nascimento: {formatDate(selectedClient.birthDate)}</li>
                  {selectedClient.rg && <li>• RG: {maskRG(selectedClient.rg)}</li>}
                  {selectedClient.monthlyIncome && <li>• Renda mensal: {formatCurrency(selectedClient.monthlyIncome)}</li>}
                  <li>• Valor do imóvel: {formatCurrency(watch('propertyValue'))}</li>
                  <li>• Entrada: {formatCurrency(watch('downPayment'))}</li>
                  <li>• Prazo: {watch('termMonths')} meses</li>
                  {watch('interestRate') && <li>• Taxa: {Number(watch('interestRate')).toFixed(2)}% a.a.</li>}
                </ul>
              </div>
            )}
          </div>
        );
      case 'confirm':
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Confirmar Consulta</h3>
            {error && <Alert variant="danger">{error}</Alert>}
            <Alert variant="info" className="mb-4">
              <strong>Importante:</strong> Ao confirmar, os dados do cliente serão enviados ao parceiro <strong>{selectedPartner?.displayName}</strong>
              para análise de crédito. O resultado será exibido assim que a API do parceiro responder.
              <br />
              <span className="text-red-600">Esta ação não pode ser desfeita.</span>
            </Alert>
            <div className="card p-4 space-y-3">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div><dt className="text-gray-500">Cliente</dt><dd className="font-medium">{selectedClient?.fullName}</dd></div>
                <div><dt className="text-gray-500">Parceiro</dt><dd className="font-medium">{selectedPartner?.displayName}</dd></div>
                <div><dt className="text-gray-500">Valor do Imóvel</dt><dd className="font-medium">{formatCurrency(watch('propertyValue'))}</dd></div>
                <div><dt className="text-gray-500">Entrada</dt><dd className="font-medium">{formatCurrency(watch('downPayment'))}</dd></div>
                <div><dt className="text-gray-500">Valor Financiado</dt><dd className="font-medium">{formatCurrency((watch('propertyValue') || 0) - (watch('downPayment') || 0))}</dd></div>
                <div><dt className="text-gray-500">Prazo</dt><dd className="font-medium">{watch('termMonths')} meses</dd></div>
                <div><dt className="text-gray-500">Taxa</dt><dd className="font-medium">{Number(watch('interestRate') || 9.99).toFixed(2)}% a.a.</dd></div>
              </dl>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nova Consulta de Financiamento</h1>
        <p className="text-gray-500 mt-1">Preencha os dados para realizar uma nova consulta</p>
      </div>

      <div className="card p-4">
        <nav className="flex" aria-label="Progresso">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className={`flex items-center ${index < STEPS.length - 1 ? 'flex-1' : ''}`}>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  index < currentStep ? 'bg-primary-600 text-white' :
                  index === currentStep ? 'bg-primary-600 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {index < currentStep ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : index + 1}
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`hidden lg:block h-0.5 flex-1 mx-2 ${index < currentStep ? 'bg-primary-600' : 'bg-gray-200'}`} />
                )}
              </div>
              <span className={`text-sm font-medium ${index <= currentStep ? 'text-primary-600' : 'text-gray-400'} hidden sm:block`}>
                {step.label}
              </span>
            </div>
          ))}
        </nav>
      </div>

      <form onSubmit={submitForm(onSubmitForm)} className="card p-6" noValidate>
        {renderStep()}

        <div className="mt-6 flex justify-between border-t border-gray-200 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={prevStep}
            disabled={currentStep === 0}
            className={currentStep === 0 ? 'hidden' : ''}
          >
            Voltar
          </Button>
          <div className="flex space-x-3">
            {currentStep < STEPS.length - 1 ? (
              <Button type="button" onClick={nextStep}>Próximo</Button>
            ) : (
              <Button type="submit" loading={isSubmitting || createMutation.isPending}>
                Enviar Consulta
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}