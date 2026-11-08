import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Client, PaginatedResponse } from '../types';
import { formatDate, maskCPF } from '../utils/formatters';
import { Button, Input, Select, Table, Pagination, Badge, Modal, Alert } from '../components';
import toast from 'react-hot-toast';

export function ClientsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);

  const { data, isLoading, error } = useQuery<PaginatedResponse<Client>>({
    queryKey: ['clients', page, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
      });
      const response = await api.get(`/clients?${params}`);
      return response.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente removido com sucesso');
      setDeleteModalOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao remover cliente'),
  });

  const handleDelete = (client: Client) => {
    setClientToDelete(client);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (clientToDelete) deleteMutation.mutate(clientToDelete.id);
  };

  const columns = [
    { key: 'fullName', header: 'Nome' },
    { key: 'cpf', header: 'CPF', render: (row: Client) => <span className="font-mono">{maskCPF(row.cpf)}</span> },
    { key: 'email', header: 'E-mail', render: (row: Client) => row.email || '—' },
    { key: 'status', header: 'Status', render: (row: Client) => <Badge variant={row.status === 'ACTIVE' ? 'success' : row.status === 'INACTIVE' ? 'gray' : 'warning'}>{row.status}</Badge> },
    { key: 'createdAt', header: 'Cadastrado em', render: (row: Client) => formatDate(row.createdAt) },
    {
      key: 'actions',
      header: 'Ações',
      render: (row: Client) => (
        <div className="flex items-center space-x-2">
          <Link to={`/clients/${row.id}`} className="text-primary-600 hover:text-primary-800 text-sm font-medium">Ver</Link>
          <Link to={`/clients/${row.id}/edit`} className="text-gray-600 hover:text-gray-800 text-sm font-medium">Editar</Link>
          <button onClick={() => handleDelete(row)} className="text-red-600 hover:text-red-800 text-sm font-medium">Excluir</button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="text-gray-500 mt-1">Gerencie os clientes cadastrados</p>
        </div>
        <Link to="/clients/new" className="btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Cliente
        </Link>
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por nome, CPF ou e-mail..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="max-w-xs"
            />
          </div>
          <Select
            options={[
              { value: '', label: 'Todos os status' },
              { value: 'ACTIVE', label: 'Ativo' },
              { value: 'INACTIVE', label: 'Inativo' },
              { value: 'ARCHIVED', label: 'Arquivado' },
            ]}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="max-w-xs"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="card p-6 text-center text-gray-500">Carregando...</div>
      ) : error ? (
        <Alert variant="danger">Erro ao carregar clientes: {error.message}</Alert>
      ) : (
        <>
          <Table
            data={data?.data || []}
            keyExtractor={(row) => row.id}
            columns={columns}
            emptyMessage="Nenhum cliente encontrado"
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

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Confirmar Exclusão" size="sm">
        {clientToDelete && (
          <div className="space-y-4">
            <Alert variant="warning">
              Tem certeza que deseja excluir <strong>{clientToDelete.fullName}</strong>?
              {clientToDelete._count && clientToDelete._count.consultations > 0 && (
                <p className="mt-2">Este cliente possui {clientToDelete._count.consultations} consulta(s) e será apenas arquivado.</p>
              )}
            </Alert>
            <div className="flex justify-end space-x-3">
              <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>Cancelar</Button>
              <Button variant="danger" onClick={confirmDelete} loading={deleteMutation.isPending}>
                {clientToDelete._count && clientToDelete._count.consultations > 0 ? 'Arquivar' : 'Excluir'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}