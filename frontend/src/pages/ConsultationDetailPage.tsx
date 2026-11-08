import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Consultation } from '../types';
import { formatDateTime, formatCurrency, formatPercent, getStatusBadge, getConsultationStatusLabel } from '../utils/formatters';
import { Badge, Alert } from '../components';

export function ConsultationDetailPage() {
  const { id } = useParams();

  const { data: consultation, isLoading, error } = useQuery<Consultation>({
    queryKey: ['consultation', id],
    queryFn: async () => {
      const response = await api.get(`/consultations/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  if (isLoading) return <div className="card p-6 text-center text-gray-500">Carregando...</div>;
  if (error) return <Alert variant="danger">Erro ao carregar consulta: {error.message}</Alert>;
  if (!consultation) return <Alert variant="warning">Consulta não encontrada</Alert>;

  const statusInfo = getStatusBadge(consultation.status);
  const response = consultation.responsePayload;
  const req = consultation.requestPayload;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Detalhes da Consulta</h1>
          <p className="text-gray-500 mt-1">ID: <span className="font-mono text-sm">{consultation.id}</span></p>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant={statusInfo.class.replace('badge-', '') as 'success'|'warning'|'danger'|'info'|'gray'}>
            {statusInfo.label}
          </Badge>
          {consultation.externalId && (
            <Badge variant="info">Ref: {consultation.externalId}</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Dados da Solicitação</h2>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><dt className="text-gray-500">Cliente</dt><dd className="font-medium">{consultation.client?.fullName}</dd></div>
              <div><dt className="text-gray-500">CPF</dt><dd className="font-medium font-mono">{consultation.client?.cpf}</dd></div>
              <div><dt className="text-gray-500">Parceiro</dt><dd className="font-medium">{consultation.partnerName}</dd></div>
              <div><dt className="text-gray-500">Endpoint</dt><dd className="font-medium text-xs truncate max-w-xs">{consultation.partnerEndpoint}</dd></div>
              <div><dt className="text-gray-500">Solicitado por</dt><dd className="font-medium">{consultation.requestedBy?.fullName}</dd></div>
              <div><dt className="text-gray-500">Iniciada em</dt><dd className="font-medium">{formatDateTime(consultation.startedAt)}</dd></div>
              {consultation.completedAt && (
                <div><dt className="text-gray-500">Concluída em</dt><dd className="font-medium">{formatDateTime(consultation.completedAt)}</dd></div>
              )}
            </dl>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Dados do Financiamento</h2>
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><dt className="text-gray-500">Valor do Imóvel</dt><dd className="font-medium">{formatCurrency(req.financingData.propertyValue)}</dd></div>
              <div><dt className="text-gray-500">Entrada</dt><dd className="font-medium">{formatCurrency(req.financingData.downPayment)}</dd></div>
              <div><dt className="text-gray-500">Valor Financiado</dt><dd className="font-medium">{formatCurrency(req.financingData.loanAmount)}</dd></div>
              <div><dt className="text-gray-500">Prazo</dt><dd className="font-medium">{req.financingData.termMonths} meses</dd></div>
              {req.financingData.interestRate && (
                <div><dt className="text-gray-500">Taxa Anual</dt><dd className="font-medium">{formatPercent(req.financingData.interestRate)}</dd></div>
              )}
            </dl>
          </div>

          {response && (
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
                Resultado da Análise
                <Badge variant={response.status === 'approved' ? 'success' : response.status === 'denied' ? 'danger' : 'warning'}>
                  {getConsultationStatusLabel(response.status)}
                </Badge>
              </h2>
              {response.errors && response.errors.length > 0 && (
                <Alert variant="danger" className="mb-4">
                  <strong>Erros retornados pela API:</strong>
                  <ul className="mt-2 list-disc list-inside text-sm">
                    {response.errors.map((err, i) => (
                      <li key={i}>{err.message} {err.field && `(${err.field})`}</li>
                    ))}
                  </ul>
                </Alert>
              )}
              {response.data && (
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {response.data.approvedAmount !== undefined && (
                    <div><dt className="text-gray-500">Valor Aprovado</dt><dd className="font-medium text-green-600">{formatCurrency(response.data.approvedAmount)}</dd></div>
                  )}
                  {response.data.interestRate !== undefined && (
                    <div><dt className="text-gray-500">Taxa Efetiva</dt><dd className="font-medium">{formatPercent(response.data.interestRate)}</dd></div>
                  )}
                  {response.data.termMonths !== undefined && (
                    <div><dt className="text-gray-500">Prazo Aprovado</dt><dd className="font-medium">{response.data.termMonths} meses</dd></div>
                  )}
                  {response.data.monthlyPayment !== undefined && (
                    <div><dt className="text-gray-500">Parcela Mensal</dt><dd className="font-medium">{formatCurrency(response.data.monthlyPayment)}</dd></div>
                  )}
                  {response.data.totalAmount !== undefined && (
                    <div><dt className="text-gray-500">Total a Pagar</dt><dd className="font-medium">{formatCurrency(response.data.totalAmount)}</dd></div>
                  )}
                  {response.data.validUntil && (
                    <div><dt className="text-gray-500">Válido até</dt><dd className="font-medium">{formatDateTime(response.data.validUntil)}</dd></div>
                  )}
                  {response.data.conditions && response.data.conditions.length > 0 && (
                    <div className="md:col-span-2">
                      <dt className="text-gray-500">Condições</dt>
                      <dd className="mt-1">
                        <ul className="list-disc list-inside text-sm space-y-1">
                          {response.data.conditions.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                      </dd>
                    </div>
                  )}
                  {response.data.restrictions && response.data.restrictions.length > 0 && (
                    <div className="md:col-span-2">
                      <dt className="text-gray-500">Restrições / Pendências</dt>
                      <dd className="mt-1">
                        <ul className="list-disc list-inside text-sm space-y-1 text-red-600">
                          {response.data.restrictions.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </dd>
                    </div>
                  )}
                </dl>
              )}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500">
                  Resposta recebida em: {formatDateTime(response.timestamp)}
                  {consultation.externalId && ` | ID Externo: ${consultation.externalId}`}
                </p>
              </div>
            </div>
          )}

          {consultation.errorMessage && (
            <div className="card p-6 border-red-200">
              <h2 className="text-lg font-semibold text-red-800 mb-2 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                Erro na Consulta
              </h2>
              <p className="text-red-700">{consultation.errorMessage}</p>
              {consultation.errorCode && <p className="text-sm text-red-600 mt-1">Código: {consultation.errorCode}</p>}
            </div>
          )}

          {!response && consultation.status !== 'FAILED' && (
            <Alert variant="warning">
              A consulta ainda não possui resultado. Status atual: <strong>{statusInfo.label}</strong>.
            </Alert>
          )}
        </div>

        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ações</h2>
            <div className="space-y-2">
              <Link to="/consultations" className="btn-secondary w-full text-center">Voltar à Lista</Link>
              <Link to={`/clients/${consultation.clientId}`} className="btn-outline w-full text-center">Ver Cliente</Link>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informações Técnicas</h2>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-gray-500">Status</dt><dd className="font-medium">{consultation.status}</dd></div>
              <div><dt className="text-gray-500">ID Externo</dt><dd className="font-medium font-mono text-xs">{consultation.externalId || 'Não informado'}</dd></div>
              <div><dt className="text-gray-500">Código de Erro</dt><dd className="font-medium font-mono text-xs">{consultation.errorCode || '—'}</dd></div>
              <div><dt className="text-gray-500">Expira em</dt><dd className="font-medium">{consultation.expiresAt ? formatDateTime(consultation.expiresAt) : 'Não expira'}</dd></div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}