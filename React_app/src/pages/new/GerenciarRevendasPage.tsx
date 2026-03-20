/**
 * Página Dedicada: Gerenciar Revendas
 *
 * Exibe:
 * - Estatísticas de Revendas (Total, Pendentes, Ativas, Rejeitadas)
 * - Fila de aprovação de revendas pendentes
 * - Lista completa de revendas com filtros
 * - Ações: criar, aprovar, rejeitar
 */

import React, { useEffect, useState } from "react";
import { useAuthStore, selectIsActiveUser } from "../../stores/new/authStore";
import Sidebar from "../../components/new/sidebar";
import BodyContent from "../../components/new/body";
import Header from "../../components/new/header";
import PermissionGuard from "../../components/new/PermissionGuard";
import { RevendaPendingApprovals } from "../../components/new/RevendaPendingApprovals";
import { CreateRevendaModal } from "../../components/new/CreateRevendaModal";
import { useAdminRevendas } from "../../hooks/new/useAdminRevendas";
import { useAdminStats } from "../../hooks/new/useAdminStats";
import type { Revenda } from "../../types/admin";

interface StatCard {
  label: string;
  value: number;
  subValue: string;
}

interface StatsSectionProps {
  cards: StatCard[];
  loading: boolean;
}

export function GerenciarRevendasPage() {
  const authState = useAuthStore();
  const isActiveUser = selectIsActiveUser(authState);

  const [showCreateRevenda, setShowCreateRevenda] = useState(false);

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

  useEffect(() => {
    if (isActiveUser) {
      fetchPendingRevendas();
      fetchStats();
      fetchAllRevendas();
    }
  }, [isActiveUser]);

  return (
    <PermissionGuard allowedRoles={["admin"]} requireActive>
      <div className="w-full h-full text-dashboard-text-primary flex bg-dashboard-bg-primary">
        <Sidebar />
        <BodyContent>
          <Header page="admin" />

          <div className="flex items-center justify-between px-4 mb-8">
            <h1 className="text-3xl font-bold">Revendas</h1>
            <button
              onClick={() => {
                fetchStats();
                fetchAllRevendas();
                fetchPendingRevendas();
              }}
              className="bg-dashboard-accent p-2 rounded-lg font-bold hover:bg-dashboard-accent-hover transition"
            >
              Atualizar
            </button>
          </div>

          {/* Erros globais */}
          {(revendasError || statsError) && (
            <div className="mx-4 mb-6 p-4 bg-red-900 border border-red-700 rounded-lg text-red-100">
              <p className="font-medium">Erro ao carregar dados:</p>
              <p className="text-sm">{revendasError || statsError}</p>
            </div>
          )}

          {/* Stats Section */}
          <div className="px-4 mb-8">
            <StatsSection
              cards={[
                {
                  label: "Total de Revendas",
                  value: stats?.totalRevendas || 0,
                  subValue: `${stats?.activeRevendas || 0} ativas`,
                },
                {
                  label: "Revendas Pendentes",
                  value: stats?.pendingRevendas || 0,
                  subValue: `${stats?.rejectedRevendas || 0} rejeitadas`,
                },
              ]}
              loading={loadingStats}
            />
          </div>

          {/* Revendas Pendentes de Aprovação */}
          <div className="px-4 mb-8">
            <RevendaPendingApprovals
              onApprovalChange={() => {
                fetchStats();
                fetchPendingRevendas();
                fetchAllRevendas();
              }}
            />
          </div>

          {/* Lista Completa de Revendas */}
          <div className="px-4 mb-8">
            <RevendasSection
              revendas={allRevendas}
              loading={loadingRevendas}
              onRefresh={fetchAllRevendas}
              onCreateClick={() => setShowCreateRevenda(true)}
            />
          </div>

          {/* Modal Criar Revenda */}
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
        </BodyContent>
      </div>
    </PermissionGuard>
  );
}

/**
 * Seção de Estatísticas
 */
function StatsSection({ cards, loading }: StatsSectionProps) {
  if (loading) {
    return (
      <div className="bg-dashboard-bg-secondary rounded-lg p-6 border border-dashboard-border">
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
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-dashboard-bg-secondary rounded-lg p-6 border border-dashboard-border hover:border-dashboard-accent transition-colors"
        >
          <p className="text-sm text-dashboard-text-secondary font-medium">
            {card.label}
          </p>
          <p className="text-4xl font-bold text-dashboard-text-primary mt-2">
            {card.value}
          </p>
          <p className="text-xs text-dashboard-text-tertiary mt-1">
            {card.subValue}
          </p>
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
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredRevendas = revendas.filter((r) =>
    filterStatus === "all" ? true : r.status === filterStatus,
  );

  return (
    <div className="bg-dashboard-bg-secondary rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-dashboard-text-primary">
          Revendas
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
            className="px-3 py-1 text-sm bg-dashboard-accent hover:bg-dashboard-accent-hover disabled:bg-gray-600 rounded transition text-white font-bold"
          >
            {loading ? "Carregando..." : "Atualizar"}
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
                : "bg-dashboard-bg-tertiary text-white hover:bg-dashboard-border"
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
        <div className="text-center py-8 text-dashboard-text-secondary">
          <p>
            Nenhuma revenda{" "}
            {filterStatus !== "all" ? `com status "${filterStatus}"` : ""}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto scrollbar scrollbar-thin scrollbar-thumb-dashboard-accent scrollbar-track-dashboard-bg-tertiary">
          {filteredRevendas.map((revenda, idx) => (
            <div
              key={revenda._id ?? revenda.email ?? `revenda-${idx}`}
              className="border border-dashboard-border rounded-lg p-4 hover:bg-dashboard-border transition bg-dashboard-bg-tertiary"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-dashboard-text-primary">
                    {revenda.name}
                  </h3>
                  <p className="text-sm text-dashboard-text-secondary mt-1">
                    {revenda.email}
                  </p>
                  <p className="text-xs text-dashboard-text-tertiary mt-1">
                    Domínio: {revenda.domain}
                  </p>
                  {revenda.cnpj_revenda && (
                    <p className="text-xs text-dashboard-text-tertiary mt-1">
                      CNPJ: {revenda.cnpj_revenda}
                    </p>
                  )}
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
                    ? "Ativa"
                    : revenda.status === "pending"
                      ? "Pendente"
                      : "Rejeitada"}
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

export default GerenciarRevendasPage;
