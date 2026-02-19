/**
 * Dashboard de Revenda Completo
 *
 * Segue o padrão estético da HomePage (baseado em FieldNET NextGen):
 * - Sidebar + BodyContent + Header
 * - Fundo escuro (--dashboard-bg-primary: #272727)
 * - Botões verdes (--dashboard-accent: #08cb7c)
 * - Texto off-white (--dashboard-text-primary: #FBFBFB)
 * - Tipografia: Roboto
 *
 * Exibe:
 * - Estatísticas dos clientes da revenda
 * - Fila de aprovação de clientes
 * - Lista de clientes da revenda
 * - Monitoramento de pivôs
 */

import React, { useEffect, useState } from 'react';
import { useAuthStore, selectIsActiveUser } from '../../stores/new/authStore';
import Sidebar from '../../components/new/sidebar';
import BodyContent from '../../components/new/body';
import Header from '../../components/new/header';
import PermissionGuard from '../../components/new/PermissionGuard';
import { ClientePendingApprovals } from '../../components/new/ClientePendingApprovals';
import PivosSection from '../../components/new/PivosSection';
import { useRevendaClientes } from '../../hooks/new/useRevendaClientes';
import { useRevendaStats } from '../../hooks/new/useRevendaStats';
import type { Cliente } from '../../types/admin';

/**
 * Componente principal do Dashboard Revenda
 */
export function RevendaDashboard() {
  const authState = useAuthStore();
  const isActiveUser = selectIsActiveUser(authState);

  // Hooks para dados
  const {
    clientes,
    loading: loadingClientes,
    error: clientesError,
    fetchClientes,
    fetchPendingClientes,
  } = useRevendaClientes();

  const {
    stats,
    loading: loadingStats,
    error: statsError,
    fetchStats,
  } = useRevendaStats();

  // Carregar dados ao montar
  useEffect(() => {
    if (isActiveUser) {
      fetchPendingClientes();
      fetchStats();
      fetchClientes();
    }
  }, [isActiveUser]);

  return (
    <PermissionGuard allowedRoles={['revenda']} requireActive>
      <div className="w-full h-full text-dashboard-text-primary flex bg-dashboard-bg-primary">
        <Sidebar />
        <BodyContent>
          <Header page="revenda" />

          <div className="flex items-center justify-between px-4 mb-4">
            <h1 className="text-2xl font-bold">🏢 Painel da Revenda</h1>
            <button
              onClick={() => {
                fetchStats();
                fetchClientes();
                fetchPendingClientes();
              }}
              className="bg-dashboard-accent p-2 rounded-lg font-bold hover:bg-dashboard-accent-hover transition"
            >
              ⟳ Atualizar
            </button>
          </div>

          {/* Erros globais */}
          {(clientesError || statsError) && (
            <div className="mx-4 mb-6 p-4 bg-red-900 border border-red-700 rounded-lg text-red-100">
              <p className="font-medium">⚠️ Erro ao carregar dados:</p>
              <p className="text-sm">{clientesError || statsError}</p>
            </div>
          )}

          {/* Stats Grid */}
          <div className="px-4 mb-4">
            <StatsGrid stats={stats} loading={loadingStats} />
          </div>

          {/* Clientes Pendentes de Aprovação */}
          <div className="px-4 mb-6">
            <ClientePendingApprovals
              onApprovalChange={() => {
                fetchStats();
                fetchPendingClientes();
                fetchClientes();
              }}
            />
          </div>

          {/* Sections em Grid */}
          <div className="px-4 mb-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ClientesSection
              clientes={clientes}
              loading={loadingClientes}
              onRefresh={fetchClientes}
            />
            <div className="bg-dashboard-bg-secondary rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-dashboard-text-primary mb-4">
                💧 Pivôs
              </h2>
              <p className="text-dashboard-text-secondary mb-4">
                Acompanhe todos os pivôs de seus clientes
              </p>
              <button className="w-full bg-dashboard-accent hover:bg-dashboard-accent-hover text-black px-4 py-2 rounded-lg font-bold transition-colors">
                Ver Todos os Pivôs
              </button>
            </div>
          </div>

          {/* Pivôs Section */}
          <div className="px-4 mb-4">
            <PivosSection />
          </div>
        </BodyContent>
      </div>
    </PermissionGuard>
  );
}

/**
 * Grid de Estatísticas
 */
function StatsGrid({
  stats,
  loading,
}: {
  stats: any;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-dashboard-bg-secondary animate-pulse h-24 rounded-lg"
          ></div>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const statCards = [
    {
      label: 'Total de Clientes',
      value: stats.totalClientes || 0,
      subValue: `${stats.activeClientes || 0} ativos`,
      color: 'bg-blue-900 text-blue-100 border border-blue-700',
      icon: '👥',
    },
    {
      label: 'Clientes Pendentes',
      value: stats.pendingClientes || 0,
      subValue: 'Aguardando aprovação',
      color: 'bg-yellow-900 text-yellow-100 border border-yellow-700',
      icon: '⏳',
    },
    {
      label: 'Total de Pivôs',
      value: stats.totalPivos || 0,
      subValue: `${stats.activePivos || 0} ativos`,
      color: 'bg-green-900 text-green-100 border border-green-700',
      icon: '💧',
    },
    {
      label: 'Pivôs Alarmados',
      value: stats.alarmadoPivos || 0,
      subValue: 'Requerem atenção',
      color: 'bg-red-900 text-red-100 border border-red-700',
      icon: '🚨',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {statCards.map((stat) => (
        <div
          key={stat.label}
          className={`rounded-lg p-6 ${stat.color} shadow-md hover:shadow-lg transition-shadow`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium opacity-75">{stat.label}</p>
              <p className="text-3xl font-bold mt-2">{stat.value}</p>
              <p className="text-xs mt-2 opacity-60">{stat.subValue}</p>
            </div>
            <span className="text-3xl">{stat.icon}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Seção de Clientes
 */
interface ClientesSectionProps {
  clientes: Cliente[];
  loading: boolean;
  onRefresh: () => void;
}

function ClientesSection({
  clientes,
  loading,
  onRefresh,
}: ClientesSectionProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredClientes = clientes.filter((c) =>
    filterStatus === 'all' ? true : c.status === filterStatus
  );

  return (
    <div className="bg-dashboard-bg-secondary rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-dashboard-text-primary">
          👥 Meus Clientes
        </h2>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-1 text-sm bg-dashboard-accent hover:bg-dashboard-accent-hover disabled:bg-gray-600 rounded transition text-white font-bold"
        >
          {loading ? '⟳ Carregando...' : '⟳ Atualizar'}
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {['all', 'active', 'pending', 'rejected'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1 rounded text-sm transition ${
              filterStatus === status
                ? 'bg-dashboard-accent text-black font-bold'
                : 'bg-dashboard-bg-tertiary text-white hover:bg-dashboard-bg-tertiary'
            }`}
          >
            {status === 'all'
              ? 'Todos'
              : status === 'active'
              ? 'Ativos'
              : status === 'pending'
              ? 'Pendentes'
              : 'Rejeitados'}
            ({
              clientes.filter((c) =>
                status === 'all' ? true : c.status === status
              ).length
            })
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dashboard-accent"></div>
        </div>
      ) : filteredClientes.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>Nenhum cliente {filterStatus !== 'all' ? `com status "${filterStatus}"` : ''}</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto scrollbar scrollbar-thin scrollbar-thumb-dashboard-accent scrollbar-track-dashboard-bg-tertiary">
          {filteredClientes.map((cliente) => (
            <div
              key={cliente._id}
              className="border border-dashboard-border rounded-lg p-3 hover:bg-dashboard-bg-tertiary transition bg-dashboard-bg-tertiary"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-dashboard-text-primary">{cliente.name}</h3>
                  <p className="text-sm text-dashboard-text-secondary">{cliente.email}</p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded font-bold ${
                    cliente.status === 'active'
                      ? 'bg-green-900 text-green-100'
                      : cliente.status === 'pending'
                      ? 'bg-yellow-900 text-yellow-100'
                      : 'bg-red-900 text-red-100'
                  }`}
                >
                  {cliente.status === 'active'
                    ? '✓ Ativo'
                    : cliente.status === 'pending'
                    ? '⏳ Pendente'
                    : '✕ Rejeitado'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="w-full mt-4 bg-dashboard-accent hover:bg-dashboard-accent-hover text-black px-4 py-2 rounded-lg font-bold transition-colors">
        Ver Relatório Completo
      </button>
    </div>
  );
}

export default RevendaDashboard;
