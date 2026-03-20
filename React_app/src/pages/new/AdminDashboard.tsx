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

import React, { useEffect, useState } from "react";
import { useAuthStore, selectIsActiveUser } from "../../stores/new/authStore";
import Sidebar from "../../components/new/sidebar";
import BodyContent from "../../components/new/body";
import Header from "../../components/new/header";
import PermissionGuard from "../../components/new/PermissionGuard";
import { RevendaPendingApprovals } from "../../components/new/RevendaPendingApprovals";
import PivosSection from "../../components/new/PivosSection";
import { CreateRevendaModal } from "../../components/new/CreateRevendaModal";
import { CreateClienteModal } from "../../components/new/CreateClienteModal";
import { CreateAdminModal } from "../../components/new/CreateAdminModal";
import { fetchAdmins } from "../../api/new/fastapi-admin";
import { useAdminRevendas } from "../../hooks/new/useAdminRevendas";
import { useAdminStats } from "../../hooks/new/useAdminStats";
import { useAdminClientes } from "../../hooks/new/useAdminClientes";
import type {
  AdminStats as AdminStatsType,
  Revenda,
  Cliente,
} from "../../types/admin";

/**
 * Componente principal do Dashboard Admin
 */
export function AdminDashboard() {
  const authState = useAuthStore();
  const isActiveUser = selectIsActiveUser(authState);

  // State para modais
  const [showCreateRevenda, setShowCreateRevenda] = useState(false);
  const [showCreateCliente, setShowCreateCliente] = useState(false);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);

  // State para admins
  const [admins, setAdmins] = useState<any[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  const loadAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const data: any = await fetchAdmins();
      setAdmins(data.admins || []);
    } catch {
      // silently fail
    } finally {
      setLoadingAdmins(false);
    }
  };

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
      loadAdmins();
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

    window.addEventListener("admin:create-revenda", handleCreateRevenda);
    window.addEventListener("admin:create-cliente", handleCreateCliente);

    return () => {
      window.removeEventListener("admin:create-revenda", handleCreateRevenda);
      window.removeEventListener("admin:create-cliente", handleCreateCliente);
    };
  }, []);

  return (
    <PermissionGuard allowedRoles={["admin"]} requireActive>
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
                loadAdmins();
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

          {/* Stats Sections */}
          <div className="px-4 mb-8 space-y-6">
            {/* Revendas Stats */}
            <StatsSection
              title="📋 Revendas"
              cards={[
                {
                  label: "Total de Revendas",
                  value: stats?.totalRevendas || 0,
                  subValue: `${stats?.activeRevendas || 0} ativas`,
                  icon: "🏢",
                },
                {
                  label: "Revendas Pendentes",
                  value: stats?.pendingRevendas || 0,
                  subValue: `${stats?.rejectedRevendas || 0} rejeitadas`,
                  icon: "⏳",
                },
              ]}
              loading={loadingStats}
            />

            {/* Clientes Stats */}
            <StatsSection
              title="👥 Clientes"
              cards={[
                {
                  label: "Total de Clientes",
                  value: stats?.totalClientes || 0,
                  subValue: `${stats?.activeClientes || 0} ativos`,
                  icon: "👥",
                },
                {
                  label: "Clientes Pendentes",
                  value: stats?.pendingClientes || 0,
                  subValue: `${stats?.rejectedClientes || 0} rejeitados`,
                  icon: "⏳",
                },
              ]}
              loading={loadingStats}
            />

            {/* Pivôs Stats */}
            <StatsSection
              title="💧 Pivôs"
              cards={[
                {
                  label: "Total de Pivôs",
                  value: stats?.totalPivos || 0,
                  subValue: `${stats?.activePivos || 0} ativos`,
                  icon: "💧",
                },
                {
                  label: "Pivôs Alarmados",
                  value: stats?.alarmadoPivos || 0,
                  subValue: `${stats?.maintenancePivos || 0} em manutenção`,
                  icon: "🚨",
                },
              ]}
              loading={loadingStats}
            />
          </div>

          {/* 🏛️ SEÇÃO DE ADMINS */}
          <div className="px-4 mb-8">
            <div className="bg-dashboard-bg-secondary rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-dashboard-text-primary">
                  Administradores
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCreateAdmin(true)}
                    className="px-3 py-1 text-sm bg-dashboard-accent hover:bg-dashboard-accent-hover rounded transition text-black font-bold"
                  >
                    + Criar Admin
                  </button>
                  <button
                    onClick={loadAdmins}
                    disabled={loadingAdmins}
                    className="px-3 py-1 text-sm bg-dashboard-bg-tertiary hover:bg-dashboard-border disabled:opacity-50 rounded transition text-white"
                  >
                    {loadingAdmins ? "Carregando..." : "Atualizar"}
                  </button>
                </div>
              </div>

              {loadingAdmins ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dashboard-accent" />
                </div>
              ) : admins.length === 0 ? (
                <div className="text-center py-8 text-dashboard-text-secondary">
                  <p>Nenhum admin encontrado</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto scrollbar scrollbar-thin scrollbar-thumb-dashboard-accent scrollbar-track-dashboard-bg-tertiary">
                  {admins.map((admin: any, idx: number) => (
                    <div
                      key={admin._id ?? admin.email ?? `admin-${idx}`}
                      className="border border-dashboard-border rounded-lg p-4 hover:bg-dashboard-border transition bg-dashboard-bg-tertiary"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-dashboard-text-primary">
                            {admin.name}
                          </h3>
                          <p className="text-sm text-dashboard-text-secondary mt-1">
                            {admin.email}
                          </p>
                          {admin.cnpj_admin && (
                            <p className="text-xs text-dashboard-text-tertiary mt-1">
                              CNPJ: {admin.cnpj_admin}
                            </p>
                          )}
                        </div>
                        <span className="text-xs px-2 py-1 rounded font-bold bg-purple-900 text-purple-100">
                          Admin
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 📋 SEÇÃO DE REVENDAS */}
          <div className="px-4 mb-8">
            <h2 className="text-xl font-bold text-dashboard-text-primary mb-4">
              📋 Gerenciar Revendas
            </h2>

            {/* Revendas Pendentes de Aprovação */}
            <div className="mb-6">
              <RevendaPendingApprovals
                onApprovalChange={() => {
                  fetchStats();
                  fetchPendingRevendas();
                  fetchAllRevendas();
                }}
              />
            </div>

            {/* Lista de Revendas */}
            <RevendasSection
              revendas={allRevendas}
              loading={loadingRevendas}
              onRefresh={fetchAllRevendas}
              onCreateClick={() => setShowCreateRevenda(true)}
            />
          </div>

          {/* 👥 SEÇÃO DE CLIENTES */}
          <div className="px-4 mb-8">
            <h2 className="text-xl font-bold text-dashboard-text-primary mb-4">
              👥 Monitorar Clientes
            </h2>

            {/* Lista de Clientes */}
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

          {showCreateAdmin && (
            <CreateAdminModal
              closeModal={() => setShowCreateAdmin(false)}
              onSuccess={() => {
                setShowCreateAdmin(false);
                loadAdmins();
              }}
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
 * Seção de Estatísticas organizada por categoria
 */
interface StatCard {
  label: string;
  value: number;
  subValue: string;
  icon: string;
}

interface StatsSectionProps {
  title: string;
  cards: StatCard[];
  loading: boolean;
}

function StatsSection({ title, cards, loading }: StatsSectionProps) {
  if (loading) {
    return (
      <div className="bg-dashboard-bg-secondary rounded-lg p-6 border border-dashboard-border">
        <h3 className="text-lg font-semibold text-dashboard-text-primary mb-4">
          {title}
        </h3>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-20 bg-dashboard-bg-tertiary animate-pulse rounded"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dashboard-bg-secondary rounded-lg p-6 border border-dashboard-border">
      <h3 className="text-lg font-semibold text-dashboard-text-primary mb-4">
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="flex items-start justify-between p-4 bg-dashboard-bg-tertiary rounded-lg hover:bg-dashboard-border transition-colors"
          >
            <div className="flex-1">
              <p className="text-sm text-dashboard-text-secondary font-medium">
                {card.label}
              </p>
              <p className="text-3xl font-bold text-dashboard-text-primary mt-2">
                {card.value}
              </p>
              <p className="text-xs text-dashboard-text-tertiary mt-1">
                {card.subValue}
              </p>
            </div>
            <span className="text-3xl ml-4">{card.icon}</span>
          </div>
        ))}
      </div>
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
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredRevendas = revendas.filter((r) =>
    filterStatus === "all" ? true : r.status === filterStatus,
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
            {loading ? "⟳ Carregando..." : "⟳ Atualizar"}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {["all", "active", "pending", "rejected"].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1 rounded text-sm transition ${
              filterStatus === status
                ? "bg-dashboard-accent text-black font-bold"
                : "bg-dashboard-bg-tertiary text-white hover:bg-dashboard-bg-tertiary"
            }`}
          >
            {status === "all"
              ? "Todas"
              : status === "active"
                ? "Ativas"
                : status === "pending"
                  ? "Pendentes"
                  : "Rejeitadas"}
            (
            {
              revendas.filter((r) =>
                status === "all" ? true : r.status === status,
              ).length
            }
            )
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
          <p>
            Nenhuma revenda{" "}
            {filterStatus !== "all" ? `com status "${filterStatus}"` : ""}
          </p>
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
                  <h3 className="font-semibold text-dashboard-text-primary">
                    {revenda.name}
                  </h3>
                  <p className="text-sm text-dashboard-text-secondary">
                    {revenda.email}
                  </p>
                  <p className="text-xs text-dashboard-text-tertiary mt-1">
                    Domínio: {revenda.domain}
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded font-bold ${
                    revenda.status === "active"
                      ? "bg-green-900 text-green-100"
                      : revenda.status === "pending"
                        ? "bg-yellow-900 text-yellow-100"
                        : "bg-red-900 text-red-100"
                  }`}
                >
                  {revenda.status === "active"
                    ? "✓ Ativa"
                    : revenda.status === "pending"
                      ? "⏳ Pendente"
                      : "✕ Rejeitada"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* <button className="w-full mt-4 bg-dashboard-accent hover:bg-dashboard-accent-hover text-black px-4 py-2 rounded-lg font-bold transition-colors"> */}
      {/*   Ver Relatório Completo */}
      {/* </button> */}
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
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredClientes = clientes.filter((c) =>
    filterStatus === "all" ? true : c.status === filterStatus,
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
            {loading ? "⟳ Carregando..." : "⟳ Atualizar"}
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {["all", "active", "pending", "rejected"].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1 rounded text-sm transition ${
              filterStatus === status
                ? "bg-dashboard-accent text-black font-bold"
                : "bg-dashboard-bg-tertiary text-white hover:bg-dashboard-bg-tertiary"
            }`}
          >
            {status === "all"
              ? "Todos"
              : status === "active"
                ? "Ativos"
                : status === "pending"
                  ? "Pendentes"
                  : "Rejeitados"}
            (
            {
              clientes.filter((c) =>
                status === "all" ? true : c.status === status,
              ).length
            }
            )
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
          <p>
            Nenhum cliente{" "}
            {filterStatus !== "all" ? `com status "${filterStatus}"` : ""}
          </p>
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
                  <h3 className="font-semibold text-dashboard-text-primary">
                    {cliente.name}
                  </h3>
                  <p className="text-sm text-dashboard-text-secondary">
                    {cliente.email}
                  </p>
                  {cliente.revenda_id && (
                    <p className="text-xs text-dashboard-text-tertiary mt-1">
                      Revenda: {cliente.revenda_id}
                    </p>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded font-bold ${
                    cliente.status === "active"
                      ? "bg-green-900 text-green-100"
                      : cliente.status === "pending"
                        ? "bg-yellow-900 text-yellow-100"
                        : "bg-red-900 text-red-100"
                  }`}
                >
                  {cliente.status === "active"
                    ? "✓ Ativo"
                    : cliente.status === "pending"
                      ? "⏳ Pendente"
                      : "✕ Rejeitado"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* <button className="w-full mt-4 bg-dashboard-accent hover:bg-dashboard-accent-hover text-black px-4 py-2 rounded-lg font-bold transition-colors"> */}
      {/*   Ver Relatório Completo */}
      {/* </button> */}
    </div>
  );
}

export default AdminDashboard;
