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
 * - Lista de clientes da revenda
 * - Monitoramento de pivôs
 */

import React, { useEffect, useState } from "react";
import { useAuthStore, selectIsActiveUser } from "../../stores/new/authStore";
import Sidebar from "../../components/new/sidebar";
import BodyContent from "../../components/new/body";
import Header from "../../components/new/header";
import PermissionGuard from "../../components/new/PermissionGuard";

import PivosSection from "../../components/new/PivosSection";
import { useRevendaClientes } from "../../hooks/new/useRevendaClientes";
import { useRevendaStats } from "../../hooks/new/useRevendaStats";
import { useDataStoreIrrigadores } from "../../stores/new/dataStoreIrrigadores";
import type { Cliente } from "../../types/admin";

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
  } = useRevendaClientes();

  const {
    stats,
    loading: loadingStats,
    error: statsError,
    fetchStats,
  } = useRevendaStats();

  const irrigadores = useDataStoreIrrigadores((s) => s.irrigadores);
  const loadingIrrigadores = useDataStoreIrrigadores((s) => s.isLoading);
  const loadingRecentIrrigadores = useDataStoreIrrigadores(
    (s) => s.isLoadingRecent,
  );
  const irrigadoresError = useDataStoreIrrigadores((s) => s.error);
  const fetchIrrigadores = useDataStoreIrrigadores((s) => s.fetchIrrigadores);

  // Carregar dados ao montar
  useEffect(() => {
    if (isActiveUser) {
      fetchStats();
      fetchClientes();
      fetchIrrigadores();
    }
  }, [isActiveUser]);

  return (
    <PermissionGuard allowedRoles={["revenda"]} requireActive>
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
                fetchIrrigadores();
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

          {/* Stats Sections */}
          <div className="px-4 mb-8 space-y-6">
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
                  subValue: "Requerem atenção",
                  icon: "🚨",
                },
              ]}
              loading={loadingStats}
            />
          </div>

          {/* 👥 SEÇÃO DE CLIENTES */}
          <div className="px-4 mb-8">
            <h2 className="text-xl font-bold text-dashboard-text-primary mb-4">
              👥 Gerenciar Clientes
            </h2>

            {/* Lista de Clientes */}
            <ClientesSection
              clientes={clientes}
              loading={loadingClientes}
              onRefresh={fetchClientes}
            />
          </div>

          {/* 💧 SEÇÃO DE PIVÔS */}
          <div className="px-4 mb-8">
            <h2 className="text-xl font-bold text-dashboard-text-primary mb-4">
              💧 Acompanhar Pivôs
            </h2>
            <PivosSection
              pivos={irrigadores as any}
              loading={loadingIrrigadores}
              loadingRecent={loadingRecentIrrigadores}
              error={irrigadoresError}
              onRefresh={fetchIrrigadores}
            />
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
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredClientes = clientes.filter((c) =>
    filterStatus === "all" ? true : c.status === filterStatus,
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
          {loading ? "⟳ Carregando..." : "⟳ Atualizar"}
        </button>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex gap-2 flex-wrap">
        {["all", "active"].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3 py-1 rounded text-sm transition ${
              filterStatus === status
                ? "bg-dashboard-accent text-black font-bold"
                : "bg-dashboard-bg-tertiary text-white hover:bg-dashboard-bg-tertiary"
            }`}
          >
            {status === "all" ? "Todos" : "Ativos"}
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
                </div>
                <span
                  className="text-xs px-2 py-1 rounded font-bold bg-green-900 text-green-100"
                >
                  Ativo
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

export default RevendaDashboard;
