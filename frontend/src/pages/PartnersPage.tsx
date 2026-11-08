import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Partner } from '../types';
import { Button, Input, Select, Modal, Alert, Badge, Table } from '../components';
import toast from 'react-hot-toast';

export function PartnersPage() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    baseUrl: '',
    authType: 'none',
    credentials: {},
    isActive: false,
    isTestEnv: true,
    rateLimit: 60,
    requiredFields: ['fullName', 'cpf', 'birthDate', 'monthlyIncome', 'propertyValue', 'downPayment'],
  });
  const [testResult, setTestResult] = useState<{ valid: boolean; errors: string[] } | null>(null);

  const { data: partners, isLoading } = useQuery<Partner[]>({
    queryKey: ['partners', 'admin'],
    queryFn: async () => {
      const response = await api.get('/partners');
      return response.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post('/partners', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      toast.success('Parceiro criado');
      closeModal();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao criar parceiro'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof formData> }) => api.patch(`/partners/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      toast.success('Parceiro atualizado');
      closeModal();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao atualizar parceiro'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/partners/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      toast.success('Parceiro removido');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao remover parceiro'),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => api.post(`/partners/${id}/test`),
    onSuccess: (response) => {
      setTestResult(response.data);
    },
    onError: (err) => {
      setTestResult({ valid: false, errors: [err instanceof Error ? err.message : 'Erro no teste'] });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => api.post(`/partners/${id}/set-default`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partners'] });
      toast.success('Parceiro padrão definido');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao definir padrão'),
  });

  const openCreateModal = () => {
    setEditingPartner(null);
    setFormData({
      name: '',
      displayName: '',
      baseUrl: '',
      authType: 'none',
      credentials: {},
      isActive: false,
      isTestEnv: true,
      rateLimit: 60,
      requiredFields: ['fullName', 'cpf', 'birthDate', 'monthlyIncome', 'propertyValue', 'downPayment'],
    });
    setTestResult(null);
    setModalOpen(true);
  };

  const openEditModal = (partner: Partner) => {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      displayName: partner.displayName,
      baseUrl: partner.baseUrl,
      authType: partner.authType,
      credentials: {},
      isActive: partner.isActive,
      isTestEnv: partner.isTestEnv,
      rateLimit: partner.rateLimit,
      requiredFields: partner.requiredFields,
    });
    setTestResult(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingPartner(null);
    setTestResult(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPartner) {
      updateMutation.mutate({ id: editingPartner.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleTest = (id: string) => {
    testMutation.mutate(id);
  };

  const columns = [
    { key: 'displayName', header: 'Nome' },
    { key: 'name', header: 'Identificador', render: (p: Partner) => <span className="font-mono text-xs">{p.name}</span> },
    { key: 'baseUrl', header: 'URL Base', render: (p: Partner) => <span className="text-xs truncate max-w-xs">{p.baseUrl}</span> },
    { key: 'authType', header: 'Auth', render: (p: Partner) => <Badge variant="gray">{p.authType}</Badge> },
    { key: 'isTestEnv', header: 'Ambiente', render: (p: Partner) => <Badge variant={p.isTestEnv ? 'warning' : 'info'}>{p.isTestEnv ? 'Teste' : 'Produção'}</Badge> },
    { key: 'isActive', header: 'Status', render: (p: Partner) => <Badge variant={p.isActive ? 'success' : 'gray'}>{p.isActive ? 'Ativo' : 'Inativo'}</Badge> },
    { key: 'isConfigured', header: 'Configurado', render: (p: Partner) => <Badge variant={p.isConfigured ? 'success' : 'danger'}>{p.isConfigured ? 'Sim' : 'Não'}</Badge> },
    {
      key: 'actions',
      header: 'Ações',
      render: (p: Partner) => (
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => handleTest(p.id)} loading={testMutation.isPending && testMutation.variables === p.id}>
            Testar
          </Button>
          {!p.isConfigured && p.isActive && (
            <Button variant="outline" size="sm" onClick={() => setDefaultMutation.mutate(p.id)} loading={setDefaultMutation.isPending && setDefaultMutation.variables === p.id}>
              Definir Padrão
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => openEditModal(p)}>Editar</Button>
          <Button variant="danger" size="sm" onClick={() => deleteMutation.mutate(p.id)} loading={deleteMutation.isPending && deleteMutation.variables === p.id}>Excluir</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parceiros de Integração</h1>
          <p className="text-gray-500 mt-1">Configure os parceiros para consulta de financiamento</p>
        </div>
        <Button onClick={openCreateModal}>
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Parceiro
        </Button>
      </div>

      <Alert variant="info" className="mb-6">
        <strong>Importante:</strong> As credenciais sensíveis (client secret, certificados, etc.) devem ser configuradas diretamente no banco de dados ou via variáveis de ambiente do servidor.
        Este painel gerencia apenas as configurações não sensíveis. Para configurar credenciais, edite o registro diretamente no banco ou use o arquivo .env do backend.
      </Alert>

      {isLoading ? (
        <div className="card p-6 text-center text-gray-500">Carregando...</div>
      ) : (
        <Table
          data={partners || []}
          keyExtractor={(p) => p.id}
          columns={columns}
          emptyMessage="Nenhum parceiro configurado"
        />
      )}

      <Modal isOpen={modalOpen} onClose={closeModal} title={editingPartner ? 'Editar Parceiro' : 'Novo Parceiro'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Identificador *" error={formData.name ? undefined : 'Obrigatório'} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="ex: banco_exemplo" disabled={!!editingPartner} />
            <Input label="Nome de Exibição *" error={formData.displayName ? undefined : 'Obrigatório'} value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} placeholder="Ex: Banco Exemplo S.A." />
          </div>
          <Input label="URL Base *" type="url" error={formData.baseUrl ? undefined : 'Obrigatório'} value={formData.baseUrl} onChange={e => setFormData({...formData, baseUrl: e.target.value})} placeholder="https://api.bancoexemplo.com.br" />
          <Select
            label="Tipo de Autenticação"
            options={[
              { value: 'none', label: 'Nenhuma' },
              { value: 'api_key', label: 'API Key' },
              { value: 'oauth2', label: 'OAuth 2.0' },
              { value: 'basic', label: 'Basic Auth' },
              { value: 'bearer', label: 'Bearer Token' },
            ]}
            value={formData.authType}
            onChange={e => setFormData({...formData, authType: e.target.value})}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Rate Limit (req/min)" type="number" min="1" max="1000" value={formData.rateLimit} onChange={e => setFormData({...formData, rateLimit: parseInt(e.target.value)})} />
            <Select
              label="Ambiente"
              options={[
                { value: 'true', label: 'Teste' },
                { value: 'false', label: 'Produção' },
              ]}
              value={formData.isTestEnv ? 'true' : 'false'}
              onChange={e => setFormData({...formData, isTestEnv: e.target.value === 'true'})}
            />
            <Select
              label="Status"
              options={[
                { value: 'true', label: 'Ativo' },
                { value: 'false', label: 'Inativo' },
              ]}
              value={formData.isActive ? 'true' : 'false'}
              onChange={e => setFormData({...formData, isActive: e.target.value === 'true'})}
            />
          </div>
          <div>
            <label className="label">Campos Obrigatórios</label>
            <div className="flex flex-wrap gap-2">
              {['fullName', 'cpf', 'birthDate', 'rg', 'email', 'phone', 'monthlyIncome', 'profession', 'maritalStatus', 'address', 'propertyValue', 'downPayment', 'termMonths', 'interestRate'].map(field => (
                <label key={field} className="inline-flex items-center space-x-1 px-2 py-1 bg-gray-50 rounded border">
                  <input
                    type="checkbox"
                    checked={formData.requiredFields.includes(field)}
                    onChange={e => setFormData({...formData, requiredFields: e.target.checked ? [...formData.requiredFields, field] : formData.requiredFields.filter(f => f !== field)})}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm">{field}</span>
                </label>
              ))}
            </div>
          </div>
          {testResult && (
            <Alert variant={testResult.valid ? 'success' : 'danger'} className="mb-4">
              <strong>{testResult.valid ? 'Configuração válida' : 'Configuração inválida'}</strong>
              {testResult.errors.length > 0 && (
                <ul className="mt-2 list-disc list-inside text-sm">
                  {testResult.errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              )}
            </Alert>
          )}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
              {editingPartner ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}