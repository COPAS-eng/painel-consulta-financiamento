import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { User } from '../types';
import { Button, Input, Select, Table, Modal, Badge } from '../components';
import toast from 'react-hot-toast';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'users' | 'config'>('users');
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<{ key: string; value: unknown } | null>(null);

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['users', 'admin'],
    queryFn: async () => {
      const response = await api.get('/auth/users');
      return response.data;
    },
  });

  const { data: configs, isLoading: configsLoading } = useQuery<Record<string, unknown>[]>({
    queryKey: ['config', 'admin'],
    queryFn: async () => {
      const response = await api.get('/config');
      return response.data;
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { status?: string; role?: string } }) =>
      api.patch(`/auth/users/${id}/${data.status ? 'status' : 'role'}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário atualizado');
      setUserModalOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao atualizar usuário'),
  });

  const updateConfigMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => api.put(`/config/${key}`, { value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast.success('Configuração salva');
      setConfigModalOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao salvar configuração'),
  });

  const createConfigMutation = useMutation({
    mutationFn: (data: { key: string; value: unknown }) => api.post('/config', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      toast.success('Configuração criada');
      setConfigModalOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao criar configuração'),
  });

  const openUserModal = (user: User) => {
    setEditingUser(user);
    setUserModalOpen(true);
  };

  const openConfigModal = (config?: { key: string; value: unknown }) => {
    setEditingConfig(config || null);
    setConfigModalOpen(true);
  };

  const userColumns = [
    { key: 'fullName', header: 'Nome' },
    { key: 'email', header: 'E-mail' },
    { key: 'role', header: 'Role', render: (u: User) => <Badge variant={u.role === 'ADMIN' ? 'danger' : u.role === 'BROKER' ? 'info' : 'gray'}>{u.role}</Badge> },
    { key: 'status', header: 'Status', render: (u: User) => <Badge variant={u.status === 'ACTIVE' ? 'success' : u.status === 'PENDING' ? 'warning' : 'gray'}>{u.status}</Badge> },
    { key: 'lastLoginAt', header: 'Último Login', render: (u: User) => u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('pt-BR') : 'Nunca' },
    { key: 'createdAt', header: 'Criado em', render: (u: User) => new Date(u.createdAt).toLocaleString('pt-BR') },
    {
      key: 'actions',
      header: 'Ações',
      render: (u: User) => (
        <div className="flex items-center space-x-2">
          <Select
            value={u.status}
            onChange={e => updateUserMutation.mutate({ id: u.id, data: { status: e.target.value } })}
            options={[
              { value: 'ACTIVE', label: 'Ativo' },
              { value: 'INACTIVE', label: 'Inativo' },
              { value: 'PENDING', label: 'Pendente' },
            ]}
            className="w-32"
          />
          <Select
            value={u.role}
            onChange={e => updateUserMutation.mutate({ id: u.id, data: { role: e.target.value } })}
            options={[
              { value: 'ADMIN', label: 'Admin' },
              { value: 'BROKER', label: 'Corretor' },
              { value: 'VIEWER', label: 'Visualizador' },
            ]}
            className="w-32"
          />
        </div>
      ),
    },
  ];

  const configColumns = [
    { key: 'key', header: 'Chave', render: (c: Record<string, unknown>) => <span className="font-mono text-sm">{c.key as string}</span> },
    { key: 'value', header: 'Valor', render: (c: Record<string, unknown>) => <pre className="text-xs bg-gray-100 p-2 rounded max-h-20 overflow-auto">{JSON.stringify(c.value, null, 2)}</pre> },
    { key: 'updatedAt', header: 'Atualizado em', render: (c: Record<string, unknown>) => new Date(c.updatedAt as string).toLocaleString('pt-BR') },
    {
      key: 'actions',
      header: 'Ações',
      render: (c: Record<string, unknown>) => (
        <Button variant="outline" size="sm" onClick={() => openConfigModal({ key: c.key as string, value: c.value })}>Editar</Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500 mt-1">Gerencie usuários e configurações do sistema</p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="flex space-x-4" aria-label="Abas de configurações">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'users' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Usuários
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'config' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Configurações do Sistema
          </button>
        </nav>
      </div>

      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Gerenciamento de Usuários</h2>
            <Button onClick={() => openUserModal({ id: '', email: '', fullName: '', role: 'BROKER', status: 'PENDING', createdAt: '' } as User)}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Novo Usuário
            </Button>
          </div>
          {usersLoading ? (
            <div className="card p-6 text-center text-gray-500">Carregando...</div>
          ) : (
            <Table
              data={users || []}
              keyExtractor={(u) => u.id}
              columns={userColumns}
              emptyMessage="Nenhum usuário encontrado"
            />
          )}
        </div>
      )}

      {activeTab === 'config' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Configurações do Sistema</h2>
            <Button onClick={() => openConfigModal()}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nova Configuração
            </Button>
          </div>
          {configsLoading ? (
            <div className="card p-6 text-center text-gray-500">Carregando...</div>
          ) : (
            <Table
              data={configs || []}
              keyExtractor={(c) => c.key as string}
              columns={configColumns}
              emptyMessage="Nenhuma configuração encontrada"
            />
          )}
        </div>
      )}

      <Modal isOpen={userModalOpen} onClose={() => setUserModalOpen(false)} title={editingUser?.id ? 'Editar Usuário' : 'Novo Usuário'} size="md">
        {editingUser && !editingUser.id && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            try {
              await api.post('/auth/register', {
                email: formData.get('email'),
                password: formData.get('password'),
                fullName: formData.get('fullName'),
                role: formData.get('role'),
              });
              queryClient.invalidateQueries({ queryKey: ['users'] });
              toast.success('Usuário criado');
              setUserModalOpen(false);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Erro ao criar usuário');
            }
          }} className="space-y-4">
            <Input label="E-mail *" name="email" type="email" required />
            <Input label="Senha *" name="password" type="password" required minLength={8} />
            <Input label="Nome Completo *" name="fullName" required />
            <Select
              label="Role"
              name="role"
              options={[
                { value: 'BROKER', label: 'Corretor' },
                { value: 'VIEWER', label: 'Visualizador' },
              ]}
            />
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <Button type="button" variant="secondary" onClick={() => setUserModalOpen(false)}>Cancelar</Button>
              <Button type="submit">Criar</Button>
            </div>
          </form>
        )}
        {editingUser && editingUser.id && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Edite o status e role do usuário nas tabelas acima.</p>
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setUserModalOpen(false)}>Fechar</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={configModalOpen} onClose={() => setConfigModalOpen(false)} title={editingConfig ? 'Editar Configuração' : 'Nova Configuração'} size="md">
        <form onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          try {
            const key = formData.get('key') as string;
            const value = JSON.parse(formData.get('value') as string);
            if (editingConfig) {
              await updateConfigMutation.mutateAsync({ key, value });
            } else {
              await createConfigMutation.mutateAsync({ key, value });
            }
            setConfigModalOpen(false);
          } catch (err) {
            toast.error('Erro ao salvar: valor deve ser JSON válido');
          }
        }} className="space-y-4">
          {editingConfig ? (
            <div>
              <label className="label">Chave (não editável)</label>
              <input className="input bg-gray-50" value={editingConfig.key} readOnly />
            </div>
          ) : (
            <Input label="Chave *" name="key" placeholder="ex: app_name" required pattern="^[a-z_]+$" />
          )}
          <div>
            <label className="label">Valor (JSON) *</label>
            <textarea
              name="value"
              className="input font-mono text-sm"
              rows={6}
              required
              defaultValue={editingConfig ? JSON.stringify(editingConfig.value, null, 2) : '{}'}
              placeholder='{ "setting": "value" }'
            />
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="secondary" onClick={() => setConfigModalOpen(false)}>Cancelar</Button>
            <Button type="submit">{editingConfig ? 'Salvar' : 'Criar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}