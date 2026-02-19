/**
 * Dashboard Administrativo Completo
 *
 * Segue o padrão estético da HomePage (baseado em FieldNET NextGen):
 * - Sidebar + BodyContent + Header
 * - Fundo escuro (--dashboard-bg-primary: #272727)
 * - Botões verdes (--dashboard-accent: #08cb7c)
 * - Texto off-white (--dashboard-text-primary: #FBFBFB)
 * - Tipografia: Roboto
 *
 * Exibe:
 * - Estatísticas gerais do sistema (revendas, clientes, pivôs)
 * - Fila de aprovação de revendas
 * - Lista de todas as revendas com filtros
 * - Monitoramento de clientes
 * - Status dos pivôs
 */

import React, { useEffect, useState } from 'react';
import { useAuthStore, selectIsActiveUser } from '../../stores/new/authStore';
import Sidebar from '../../components/new/sidebar';
import BodyContent from '../../components/new/body';
import Header from '../../components/new/header';
import PermissionGuard from '../../components/new/PermissionGuard';
import { RevendaPendingApprovals } from '../../components/new/RevendaPendingApprovals';
import PivosSection from '../../components/new/PivosSection';
import { CreateRevendaModal } from '../../components/new/CreateRevendaModal';
import { CreateClienteModal } from '../../components/new/CreateClienteModal';
import { useAdminRevendas } from '../../hooks/new/useAdminRevendas';
import { useAdminStats } from '../../hooks/new/useAdminStats';
import { useAdminClientes } from '../../hooks/new/useAdminClientes';
import type { AdminStats as AdminStatsType, Revenda, Cliente } from '../../types/admin';

/**
 * Componente principal do Dashboard Admin
 */
export function AdminDashboard() {
  const authState = useAuthStore();
  const isActiveUser = selectIsActiveUser(authState);

  // State para modais
  const [showCreateRevenda, setShowCreateRevenda] = useState(false);
  const [showCreateCliente, setShowCreateCliente] = useState(false);

  // Hooks para dados
  const {
    allRevendas,
    loading: loadingRevendas,
    error: revendasError,
    fetchPendingRevendas,
    fetchAllRevendas,
  } = useAdminRevendas();

  const {
    stats,
    loading: loadingStats,
    error: statsError,
    fetchStats,
  } = useAdminStats();

  const {
    clientes,
    loading: loadingClientes,
    fetchClientes,
  } = useAdminClientes();

  // Carregar dados ao montar
  useEffect(() => {
    if (isActiveUser) {
      fetchPendingRevendas();
      fetchStats();
      fetchAllRevendas();
      fetchClientes();
    }
  }, [isActiveUser]);

  // Escutar eventos da sidebar para abrir modais
  useEffect(() => {
    const handleCreateRevenda = () => {
      setShowCreateRevenda(true);
    };

    const handleCreateCliente = () => {
      setShowCreateCliente(true);
    };

    window.addEventListener('admin:create-revenda', handleCreateRevenda);
    window.addEventListener('admin:create-cliente', handleCreateCliente);

    return () => {
      window.removeEventListener('admin:create-revenda', handleCreateRevenda);
      window.removeEventListener('admin:create-cliente', handleCreateCliente);
    };
  }, []);

  return (
    <PermissionGuard allowedRoles={['admin']} requireActive>
      <div className="w-full h-full text-dashboard-text-primary flex bg-dashboard-bg-primary">
        <Sidebar />
        <BodyContent>
          <Header page="admin" />

          <div className="flex items-center justify-between px-4 mb-4">
            <h1 className="text-2xl font-bold">🏛️ Painel Administrativo</h1>
            <button
              onClick={() => {
                fetchStats();
                fetchAllRevendas();
                fetchPendingRevendas();
                fetchClientes();
              }}
              className="bg-dashboard-accent p-2 rounded-lg font-bold hover:bg-dashboard-accent-hover transition"
            >
              ⟳ Atualizar
            </button>
          </div>

          {/* Erros globais */}
          {(revendasError || statsError) && (
            <div className="mx-4 mb-6 p-4 bg-red-900 border border-red-700 rounded-lg text-red-100">
              <p className="font-medium">⚠️ Erro ao carregar dados:</p>
              <p className="text-sm">{revendasError || statsError}</p>
            </div>
          )}

          {/* Stats Grid */}
          <div className="px-4 mb-4">
            <StatsGrid stats={stats} loading={loadingStats} />
          </div>

          {/* Revendas Pendentes de Aprovação */}
          <div className="px-4 mb-6">
            <RevendaPendingApprovals
              onApprovalChange={() => {
                fetchStats();
                fetchPendingRevendas();
                fetchAllRevendas();
              }}
            />
          </div>

          {/* Sections em Grid */}
          <div className="px-4 mb-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RevendasSection
              revendas={allRevendas}
              loading={loadingRevendas}
              onRefresh={fetchAllRevendas}
              onCreateClick={() => setShowCreateRevenda(true)}
            />
            <ClientesSection
              clientes={clientes}
              loading={loadingClientes}
              onRefresh={fetchClientes}
              onCreateClick={() => setShowCreateCliente(true)}
            />
          </div>

          {/* Modals */}
          {showCreateRevenda && (
            <CreateRevendaModal
              closeModal={() => setShowCreateRevenda(false)}
              onSuccess={() => {
                setShowCreateRevenda(false);
                fetchAllRevendas();
                fetchStats();
              }}
            />
          )}

          {showCreateCliente && (
            <CreateClienteModal
              closeModal={() => setShowCreateCliente(false)}
              onSuccess={() => {
                setShowCreateCliente(false);
                fetchClientes();
                fetchStats();
              }}
              revendas={allRevendas}
            />
          )}

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
  stats: AdminStatsType | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
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
      label: 'Total de Revendas',
      value: stats.totalRevendas,
      subValue: `${stats.activeRevendas} ativas`,
      color: 'bg-blue-900 text-blue-100 border border-blue-700',
      icon: '🏢',
    },
    {
      label: 'Revendas Pendentes',
      value: stats.pendingRevendas,
      subValue: `${stats.rejectedRevendas} rejeitadas`,
      color: 'bg-yellow-900 text-yellow-100 border border-yellow-700',
      icon: '⏳',
    },
    {
      label: 'Total de Clientes',
      value: stats.totalClientes,
      subValue: `${stats.activeClientes} ativos`,
      color: 'bg-purple-900 text-purple-100 border border-purple-700',
      icon: '👥',
    },
    {
      label: 'Clientes Pendentes',
      value: stats.pendingClientes,
      subValue: `${stats.rejectedClientes} rejeitados`,
      color: 'bg-orange-900 text-orange-100 border border-orange-700',
      icon: '⏳',
    },
    {
      label: 'Total de Pivôs',
      value: stats.totalPivos,
      subValue: `${stats.activePivos} ativos`,
      color: 'bg-green-900 text-green-100 border border-green-700',
      icon: '💧',
    },
    {
      label: 'Pivôs Alarmados',
      value: stats.alarmadoPivos,
      subValue: `${stats.maintenancePivos} em manutenção`,
      color: 'bg-red-900 text-red-100 border border-red-700',
      icon: '🚨',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
 * Seção de Revendas
 */
interface RevendasSectionProps {
  revendas: Revenda[];
  loading: boolean;
  onRefresh: () => void;
  onCreateClick: () => void;
}

function RevendasSection({
  revendas,
  loading,
  onRefresh,
  onCreateClick,
}: RevendasSectionProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredRevendas = revendas.filter((r) =>
    filterStatus === 'all' ? true : r.status === filterStatus
  );

  return (
    <div className="bg-dashboard-bg-secondary rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-dashboard-text-primary">
          🏢 Gerenciar Revendas
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onCreateClick}
            className="px-3 py-1 text-sm bg-dashboard-accent hover:bg-dashboard-accent-hover rounded transition text-white font-bold"
          >
            + Criar Revenda
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-1 text-sm bg-[#08cb7c] hover:bg-[#06a063] disabled:bg-gray-600 rounded transition text-white font-bold"
          >
            {loading ? '⟳ Carregando...' : '⟳ Atualizar'}
          </button>
        </div>
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
              ? 'Todas'
              : status === 'active'
              ? 'Ativas'
              : status === 'pending'
              ? 'Pendentes'
              : 'Rejeitadas'}
            ({
              revendas.filter((r) =>
                status === 'all' ? true : r.status === status
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
      ) : filteredRevendas.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>Nenhuma revenda {filterStatus !== 'all' ? `com status "${filterStatus}"` : ''}</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto scrollbar scrollbar-thin scrollbar-thumb-dashboard-accent scrollbar-track-dashboard-bg-tertiary">
          {filteredRevendas.map((revenda) => (
            <div
              key={revenda._id}
              className="border border-dashboard-border rounded-lg p-3 hover:bg-dashboard-bg-tertiary transition bg-dashboard-bg-tertiary"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-dashboard-text-primary">{revenda.name}</h3>
                  <p className="text-sm text-dashboard-text-secondary">{revenda.email}</p>
                  <p className="text-xs text-dashboard-text-tertiary mt-1">
                    Domínio: {revenda.domain}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded font-bold ${
                    revenda.status === 'active'
                      ? 'bg-green-900 text-green-100'
                      : revenda.status === 'pending'
                      ? 'bg-yellow-900 text-yellow-100'
                      : 'bg-red-900 text-red-100'
                  }`}
                >
                  {revenda.status === 'active'
                    ? '✓ Ativa'
                    : revenda.status === 'pending'
                    ? '⏳ Pendente'
                    : '✕ Rejeitada'}
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

/**
 * Seção de Clientes
 */
interface ClientesSectionProps {
  clientes: Cliente[];
  loading: boolean;
  onRefresh: () => void;
  onCreateClick: () => void;
}

function ClientesSection({
  clientes,
  loading,
  onRefresh,
  onCreateClick,
}: ClientesSectionProps) {
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const filteredClientes = clientes.filter((c) =>
    filterStatus === 'all' ? true : c.status === filterStatus
  );

  return (
    <div className="bg-dashboard-bg-secondary rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-dashboard-text-primary">
          👥 Monitorar Clientes
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onCreateClick}
            className="px-3 py-1 text-sm bg-dashboard-accent hover:bg-dashboard-accent-hover rounded transition text-white font-bold"
          >
            + Criar Cliente
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-1 text-sm bg-[#08cb7c] hover:bg-[#06a063] disabled:bg-gray-600 rounded transition text-white font-bold"
          >
            {loading ? '⟳ Carregando...' : '⟳ Atualizar'}
          </button>
        </div>
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
                  {cliente.revenda_id && (
                    <p className="text-xs text-dashboard-text-tertiary mt-1">
                      Revenda: {cliente.revenda_id}
                    </p>
                  )}
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

export default AdminDashboard;
