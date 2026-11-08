import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Client, Consent } from '../types';
import { formatDate, formatDateTime, formatCurrency, maskCPF, maskRG, maskPhone, maskEmail } from '../utils/formatters';
import { Button, Badge, Table, Modal, Alert } from '../components';
import toast from 'react-hot-toast';

export function ClientDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [consentModalOpen, setConsentModalOpen] = useState(false);
  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [consentToRevoke, setConsentToRevoke] = useState<Consent | null>(null);
  const [consentForm, setConsentForm] = useState({
    purpose: '',
    partnerName: '',
    partnerEndpoint: '',
    dataFields: ['fullName', 'cpf', 'birthDate', 'monthlyIncome', 'propertyValue', 'downPayment'],
    expiresAt: '',
  });

  const { data: client, isLoading, error } = useQuery<Client>({
    queryKey: ['client', id],
    queryFn: async () => {
      const response = await api.get(`/clients/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  const createConsentMutation = useMutation({
    mutationFn: (data: typeof consentForm) => api.post(`/clients/${id}/consents`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', id] });
      toast.success('Consentimento registrado');
      setConsentModalOpen(false);
      setConsentForm({
        purpose: '',
        partnerName: '',
        partnerEndpoint: '',
        dataFields: ['fullName', 'cpf', 'birthDate', 'monthlyIncome', 'propertyValue', 'downPayment'],
        expiresAt: '',
      });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao criar consentimento'),
  });

  const revokeConsentMutation = useMutation({
    mutationFn: (consentId: string) => api.post(`/consents/${consentId}/revoke`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', id] });
      toast.success('Consentimento revogado');
      setRevokeModalOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao revogar consentimento'),
  });

  const handleRevoke = (consent: Consent) => {
    setConsentToRevoke(consent);
    setRevokeModalOpen(true);
  };

  if (isLoading) return <div className="card p-6 text-center text-gray-500">Carregando...</div>;
  if (error) return <Alert variant="danger">Erro ao carregar cliente: {error.message}</Alert>;
  if (!client) return <Alert variant="warning">Cliente não encontrado</Alert>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{client.fullName}</h1>
          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
            <Badge variant={client.status === 'ACTIVE' ? 'success' : 'gray'}>{client.status}</Badge>
            <span>CPF: {maskCPF(client.cpf)}</span>
            {client.rg && <span>RG: {maskRG(client.rg)}</span>}
          </div>
        </div>
        <div className="flex space-x-2">
          <Link to={`/clients/${client.id}/edit`} className="btn-secondary">Editar</Link>
          <Link to={`/consultations/new?clientId=${client.id}`} className="btn-primary">Nova Consulta</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6 md:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Dados do Cliente</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><dt className="text-gray-500">E-mail</dt><dd className="font-medium">{maskEmail(client.email || 'Não informado')}</dd></div>
            <div><dt className="text-gray-500">Telefone</dt><dd className="font-medium">{maskPhone(client.phone || 'Não informado')}</dd></div>
            <div><dt className="text-gray-500">Data de Nascimento</dt><dd className="font-medium">{formatDate(client.birthDate)}</dd></div>
            <div><dt className="text-gray-500">Renda Mensal</dt><dd className="font-medium">{formatCurrency(client.monthlyIncome)}</dd></div>
            <div><dt className="text-gray-500">Profissão</dt><dd className="font-medium">{client.profession || 'Não informado'}</dd></div>
            <div><dt className="text-gray-500">Estado Civil</dt><dd className="font-medium">{client.maritalStatus || 'Não informado'}</dd></div>
            <div className="md:col-span-2"><dt className="text-gray-500">Endereço</dt><dd className="font-medium">{client.address ? JSON.stringify(client.address) : 'Não informado'}</dd></div>
          </dl>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Ações Rápidas</h2>
          <div className="space-y-3">
            <Link to={`/consultations/new?clientId=${client.id}`} className="btn-primary w-full text-center">Nova Consulta</Link>
            <Button variant="outline" className="w-full" onClick={() => setConsentModalOpen(true)}>
              Registrar Consentimento
            </Button>
            <Link to={`/clients/${client.id}/edit`} className="btn-secondary w-full text-center">Editar Dados</Link>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Consentimentos</h2>
          <Button variant="outline" size="sm" onClick={() => setConsentModalOpen(true)}>Novo</Button>
        </div>
        <div className="p-6">
          {client.consents?.length === 0 ? (
            <p className="text-center text-gray-500 py-4">Nenhum consentimento registrado</p>
          ) : (
            <Table
              data={client.consents || []}
              keyExtractor={(c) => c.id}
              columns={[
                { key: 'partnerName', header: 'Parceiro' },
                { key: 'purpose', header: 'Finalidade', render: (c) => <span className="max-w-xs truncate block">{c.purpose}</span> },
                { key: 'dataFields', header: 'Campos', render: (c) => <span className="text-xs">{c.dataFields.join(', ')}</span> },
                { key: 'status', header: 'Status', render: (c) => <Badge variant={c.status === 'GIVEN' ? 'success' : c.status === 'REVOKED' ? 'danger' : 'warning'}>{c.status}</Badge> },
                { key: 'givenAt', header: 'Concedido em', render: (c) => formatDateTime(c.givenAt) },
                { key: 'expiresAt', header: 'Expira em', render: (c) => c.expiresAt ? formatDateTime(c.expiresAt) : '—' },
                {
                  key: 'actions',
                  header: 'Ações',
                  render: (c) => c.status === 'GIVEN' && (
                    <Button variant="danger" size="sm" onClick={() => handleRevoke(c)}>Revogar</Button>
                  ),
                },
              ]}
            />
          )}
        </div>
      </div>

      <Modal isOpen={consentModalOpen} onClose={() => setConsentModalOpen(false)} title="Registrar Consentimento" size="lg">
        <form onSubmit={(e) => { e.preventDefault(); createConsentMutation.mutate(consentForm); }} className="space-y-4">
          <div>
            <label className="label">Finalidade *</label>
            <textarea
              className="input"
              rows={3}
              required
              value={consentForm.purpose}
              onChange={(e) => setConsentForm({ ...consentForm, purpose: e.target.value })}
              placeholder="Descreva a finalidade da consulta e quais dados serão compartilhados..."
            />
          </div>
          <div>
            <label className="label">Nome do Parceiro *</label>
            <input className="input" required value={consentForm.partnerName} onChange={(e) => setConsentForm({ ...consentForm, partnerName: e.target.value })} placeholder="Ex: Banco Exemplo S.A." />
          </div>
          <div>
            <label className="label">Endpoint do Parceiro *</label>
            <input className="input" type="url" required value={consentForm.partnerEndpoint} onChange={(e) => setConsentForm({ ...consentForm, partnerEndpoint: e.target.value })} placeholder="https://api.bancoexemplo.com.br" />
          </div>
          <div>
            <label className="label">Campos de Dados *</label>
            <div className="flex flex-wrap gap-2">
              {['fullName', 'cpf', 'birthDate', 'rg', 'email', 'phone', 'monthlyIncome', 'propertyValue', 'downPayment', 'termMonths', 'interestRate'].map(field => (
                <label key={field} className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-50 rounded border">
                  <input
                    type="checkbox"
                    checked={consentForm.dataFields.includes(field)}
                    onChange={(e) => setConsentForm({ ...consentForm, dataFields: e.target.checked ? [...consentForm.dataFields, field] : consentForm.dataFields.filter(f => f !== field) })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm">{field}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Data de Expiração (opcional)</label>
            <input className="input" type="datetime-local" value={consentForm.expiresAt} onChange={(e) => setConsentForm({ ...consentForm, expiresAt: e.target.value })} />
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="secondary" onClick={() => setConsentModalOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={createConsentMutation.isPending}>Salvar</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={revokeModalOpen} onClose={() => setRevokeModalOpen(false)} title="Revogar Consentimento" size="sm">
        {consentToRevoke && (
          <div className="space-y-4">
            <Alert variant="warning">
              Tem certeza que deseja revogar o consentimento para <strong>{consentToRevoke.partnerName}</strong>?
            </Alert>
            <div className="flex justify-end space-x-3">
              <Button variant="secondary" onClick={() => setRevokeModalOpen(false)}>Cancelar</Button>
              <Button variant="danger" onClick={() => revokeConsentMutation.mutate(consentToRevoke.id)} loading={revokeConsentMutation.isPending}>Revogar</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}