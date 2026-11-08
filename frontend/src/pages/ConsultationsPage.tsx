import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Consultation, PaginatedResponse } from '../types';
import { formatDateTime, getStatusBadge, getConsultationStatusLabel } from '../utils/formatters';
import { Input, Select, Table, Pagination, Badge, Alert } from '../components';

export function ConsultationsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [partnerFilter, setPartnerFilter] = useState('');
  const [clientIdFromUrl] = useState(searchParams.get('clientId') || '');

  const initialClientId = clientIdFromUrl;

  const { data, isLoading, error } = useQuery<PaginatedResponse<Consultation>>({
    queryKey: ['consultations', page, statusFilter, partnerFilter, initialClientId],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(statusFilter && { status: statusFilter }),
        ...(partnerFilter && { partnerName: partnerFilter }),
        ...(initialClientId && { clientId: initialClientId }),
      });
      const response = await api.get(`/consultations?${params}`);
      return response.data;
    },
  });

  const columns = [
    { key: 'id', header: 'ID', render: (row: Consultation) => <span className="font-mono text-xs">{row.id.slice(0, 12)}...</span> },
    { key: 'client', header: 'Cliente', render: (row: Consultation) => row.client?.fullName || '—' },
    { key: 'partnerName', header: 'Parceiro' },
    { key: 'status', header: 'Status', render: (row: Consultation) => {
      const { class: variant, label } = getStatusBadge(row.status);
      return <Badge variant={variant as 'success'|'warning'|'danger'|'info'|'gray'}>{label}</Badge>;
    }},
    { key: 'responsePayload', header: 'Resultado', render: (row: Consultation) => {
      if (!row.responsePayload?.data) return <span className="text-gray-400">—</span>;
      const status = row.responsePayload.status;
      return <Badge variant={status === 'approved' ? 'success' : status === 'denied' ? 'danger' : 'warning'}>{getConsultationStatusLabel(status)}</Badge>;
    }},
    { key: 'requestedBy', header: 'Solicitado por', render: (row: Consultation) => row.requestedBy?.fullName || '—' },
    { key: 'startedAt', header: 'Iniciada em', render: (row: Consultation) => formatDateTime(row.startedAt) },
    {
      key: 'actions',
      header: 'Ações',
      render: (row: Consultation) => (
        <Link to={`/consultations/${row.id}`} className="text-primary-600 hover:text-primary-800 text-sm font-medium">Ver Detalhes</Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Consultas</h1>
          <p className="text-gray-500 mt-1">Histórico de consultas de financiamento</p>
        </div>
        <Link to={`/consultations/new${initialClientId ? `?clientId=${initialClientId}` : ''}`} className="btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Consulta
        </Link>
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar..."
              value={searchParams.get('search') || ''}
              onChange={(e) => {
                const params = new URLSearchParams(searchParams);
                params.set('search', e.target.value);
                setSearchParams(params);
                setPage(1);
              }}
              className="max-w-xs"
            />
          </div>
          <Select
            options={[
              { value: '', label: 'Todos os status' },
              { value: 'PENDING', label: 'Aguardando' },
              { value: 'PROCESSING', label: 'Processando' },
              { value: 'COMPLETED', label: 'Concluída' },
              { value: 'FAILED', label: 'Erro' },
              { value: 'UNAVAILABLE', label: 'Indisponível' },
            ]}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="max-w-xs"
          />
          <Select
            options={[
              { value: '', label: 'Todos os parceiros' },
              { value: 'mock', label: 'Parceiro de Teste' },
            ]}
            value={partnerFilter}
            onChange={(e) => { setPartnerFilter(e.target.value); setPage(1); }}
            className="max-w-xs"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="card p-6 text-center text-gray-500">Carregando...</div>
      ) : error ? (
        <Alert variant="danger">Erro ao carregar consultas: {error.message}</Alert>
      ) : (
        <>
          <Table
            data={data?.data || []}
            keyExtractor={(row) => row.id}
            columns={columns}
            emptyMessage="Nenhuma consulta encontrada"
          />
          {data && data.pagination.totalPages > 1 && (
            <Pagination
              currentPage={data.pagination.page}
              totalPages={data.pagination.totalPages}
              onPageChange={setPage}
              showTotal
              total={data.pagination.total}
            />
          )}
        </>
      )}
    </div>
  );
}