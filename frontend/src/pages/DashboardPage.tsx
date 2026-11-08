import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ConsultationStats } from '../types';
import { formatDate } from '../utils/formatters';
import { Badge, Table } from '../components';

export function DashboardPage() {
  const { data: stats, isLoading } = useQuery<ConsultationStats>({
    queryKey: ['consultationStats'],
    queryFn: async () => {
      const response = await api.get('/consultations/stats');
      return response.data;
    },
  });

  const statCards = [
    { label: 'Total de Consultas', value: stats?.total || 0, icon: '📊' },
    { label: 'Concluídas', value: stats?.byStatus?.COMPLETED || 0, variant: 'success' as const, icon: '✅' },
    { label: 'Processando', value: stats?.byStatus?.PROCESSING || 0, variant: 'info' as const, icon: '⏳' },
    { label: 'Com Erro', value: stats?.byStatus?.FAILED || 0, variant: 'danger' as const, icon: '❌' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Visão geral das consultas de financiamento</p>
        </div>
        <Link to="/consultations/new" className="btn-primary">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Consulta
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <div key={index} className="card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center text-2xl">
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Consultas Recentes</h2>
        </div>
        {isLoading ? (
          <div className="p-6 text-center text-gray-500">Carregando...</div>
        ) : !stats || stats.recent.length === 0 ? (
          <div className="p-6 text-center text-gray-500">Nenhuma consulta realizada recentemente</div>
        ) : (
          <Table
            data={stats.recent}
            keyExtractor={(row) => row.id}
            columns={[
              { key: 'id', header: 'ID', render: (row) => <span className="font-mono text-xs">{row.id.slice(0, 12)}...</span> },
              { key: 'partnerName', header: 'Parceiro' },
              { key: 'status', header: 'Status', render: (row) => <Badge variant={row.status === 'COMPLETED' ? 'success' : row.status === 'FAILED' ? 'danger' : 'warning'}>{row.status}</Badge> },
              { key: 'startedAt', header: 'Iniciada em', render: (row) => formatDate(row.startedAt) },
            ]}
            onRowClick={(row) => window.location.href = `/consultations/${row.id}`}
          />
        )}
      </div>
    </div>
  );
}