/**
 * Dashboard de Cliente Completo
 *
 * Segue o padrão estético da HomePage (baseado em FieldNET NextGen):
 * - Sidebar + BodyContent + Header
 * - Fundo escuro (--dashboard-bg-primary: #272727)
 * - Botões verdes (--dashboard-accent: #08cb7c)
 * - Texto off-white (--dashboard-text-primary: #FBFBFB)
 * - Tipografia: Roboto
 *
 * Exibe:
 * - Status de aprovação da conta
 * - Estatísticas dos pivôs
 * - Lista de pivôs
 * - Alertas recentes
 */

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useAuthStore,
  selectIsActiveUser,
  selectIsPending,
  selectIsSuperusuario,
} from "../../stores/new/authStore";
import { fetchCompanyUsers } from "../../api/new/fastapi-admin";
import Sidebar from "../../components/new/sidebar";
import BodyContent from "../../components/new/body";
import Header from "../../components/new/header";
import PermissionGuard from "../../components/new/PermissionGuard";
import PivosSection from "../../components/new/PivosSection";
import { useClientePivos } from "../../hooks/new/useClientePivos";
import { useClienteStats } from "../../hooks/new/useClienteStats";
import type { ClienteStats as ClienteStatsType, Pivo } from "../../types/admin";

/**
 * Componente principal do Dashboard Cliente
 */
export function ClienteDashboard() {
  const authState = useAuthStore();
  const isPending = selectIsPending(authState);
  const isActiveUser = selectIsActiveUser(authState);
  const isSuperusuario = selectIsSuperusuario(authState);
  const navigate = useNavigate();

  const [companyUserCount, setCompanyUserCount] = useState(0);

  // Hooks para dados
  const {
    pivos,
    loading: loadingPivos,
    error: pivosError,
    fetchPivos,
  } = useClientePivos();

  const {
    stats,
    loading: loadingStats,
    error: statsError,
    fetchStats,
  } = useClienteStats();

  // Carregar dados ao montar
  useEffect(() => {
    if (isActiveUser) {
      fetchPivos();
      fetchStats();
      if (isSuperusuario) {
        fetchCompanyUsers()
          .then((data: any) => setCompanyUserCount(data.users?.length || 0))
          .catch(() => {});
      }
    }
  }, [isActiveUser, isSuperusuario]);

  return (
    <PermissionGuard allowedRoles={["cliente"]}>
      <div className="w-full h-full text-dashboard-text-primary flex bg-dashboard-bg-primary">
        <Sidebar />
        <BodyContent>
          <Header page="cliente" />

          <div className="flex items-center justify-between px-4 mb-4">
            <h1 className="text-2xl font-bold">👤 Meu Painel</h1>
            <button
              onClick={() => {
                fetchPivos();
                fetchStats();
              }}
              className="bg-dashboard-accent p-2 rounded-lg font-bold hover:bg-dashboard-accent-hover transition"
            >
              ⟳ Atualizar
            </button>
          </div>

          {/* Pending Status Alert */}
          {isPending && <PendingApprovalAlert />}

          {/* Erros globais */}
          {(pivosError || statsError) && (
            <div className="mx-4 mb-6 p-4 bg-red-900 border border-red-700 rounded-lg text-red-100">
              <p className="font-medium">⚠️ Erro ao carregar dados:</p>
              <p className="text-sm">{pivosError || statsError}</p>
            </div>
          )}

          {/* Stats Section */}
          <div className="px-4 mb-8">
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

          {/* Company Users Card (Superusuário only) */}
          {isSuperusuario && (
            <div className="px-4 mb-8">
              <div
                onClick={() => navigate("/gerenciar-usuarios-empresa")}
                className="bg-dashboard-bg-secondary rounded-lg p-6 border border-dashboard-border hover:border-dashboard-accent transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-dashboard-text-secondary font-medium">
                      Usuários da Empresa
                    </p>
                    <p className="text-4xl font-bold text-dashboard-text-primary mt-2">
                      {companyUserCount}
                    </p>
                    <p className="text-xs text-dashboard-text-tertiary mt-1">
                      Clique para gerenciar
                    </p>
                  </div>
                  <span className="text-3xl">👥</span>
                </div>
              </div>
            </div>
          )}

          {/* Content Sections */}
          <div className="px-4 mb-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PivosListSection
              pivos={pivos}
              loading={loadingPivos}
              onRefresh={fetchPivos}
            />
            <AlertasSection />
          </div>

          {/* Full Pivôs Section */}
          <div className="px-4 mb-4">
            <PivosSection
              pivos={pivos as any}
              loading={loadingPivos}
              error={pivosError}
              onRefresh={fetchPivos}
            />
          </div>
        </BodyContent>
      </div>
    </PermissionGuard>
  );
}

/**
 * Alerta quando a conta ainda está pendente de aprovação
 */
function PendingApprovalAlert() {
  return (
    <div className="mx-4 mb-6 p-4 bg-yellow-900 border border-yellow-700 rounded-lg">
      <div className="flex items-start">
        <svg
          className="h-6 w-6 text-yellow-400 flex-shrink-0 mr-3 mt-0.5"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <h3 className="text-sm font-medium text-yellow-100">
            ⏳ Conta Pendente de Aprovação
          </h3>
          <p className="text-sm text-yellow-200 mt-1">
            Sua solicitação de registro foi recebida. Você poderá acessar todas
            as funcionalidades assim que a revenda aprovar sua conta.
          </p>
        </div>
      </div>
    </div>
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
 * Seção de Lista de Pivôs
 */
interface PivosListSectionProps {
  pivos: Pivo[];
  loading: boolean;
  onRefresh: () => void;
}

function PivosListSection({
  pivos,
  loading,
  onRefresh,
}: PivosListSectionProps) {
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredPivos = pivos.filter((p) =>
    filterStatus === "all" ? true : p.status === filterStatus,
  );

  return (
    <div className="bg-dashboard-bg-secondary rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-dashboard-text-primary">
          💧 Meus Pivôs
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
        {["all", "active", "inactive", "maintenance", "alarmed"].map(
          (status) => (
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
                  : status === "inactive"
                    ? "Inativos"
                    : status === "maintenance"
                      ? "Manutenção"
                      : "Alarmados"}
              (
              {
                pivos.filter((p) =>
                  status === "all" ? true : p.status === status,
                ).length
              }
              )
            </button>
          ),
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dashboard-accent"></div>
        </div>
      ) : filteredPivos.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>
            Nenhum pivô{" "}
            {filterStatus !== "all" ? `com status "${filterStatus}"` : ""}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto scrollbar scrollbar-thin scrollbar-thumb-dashboard-accent scrollbar-track-dashboard-bg-tertiary">
          {filteredPivos.map((pivo) => (
            <div
              key={pivo._id}
              className="border border-dashboard-border rounded-lg p-3 hover:bg-dashboard-bg-tertiary transition bg-dashboard-bg-tertiary"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-dashboard-text-primary">
                    {pivo.name}
                  </h3>
                  <p className="text-xs text-dashboard-text-tertiary mt-1">
                    ID: {pivo._id}
                  </p>
                  {pivo.last_data && (
                    <p className="text-xs text-dashboard-text-tertiary mt-1">
                      Último dado:{" "}
                      {new Date(pivo.last_data).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded font-bold ${
                    pivo.status === "active"
                      ? "bg-green-900 text-green-100"
                      : pivo.status === "alarmed"
                        ? "bg-red-900 text-red-100"
                        : pivo.status === "maintenance"
                          ? "bg-gray-900 text-gray-100"
                          : "bg-gray-900 text-gray-100"
                  }`}
                >
                  {pivo.status === "active"
                    ? "✓ Ativo"
                    : pivo.status === "alarmed"
                      ? "🚨 Alarmado"
                      : pivo.status === "maintenance"
                        ? "🔧 Manutenção"
                        : "⊙ Inativo"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="w-full mt-4 bg-dashboard-accent hover:bg-dashboard-accent-hover text-black px-4 py-2 rounded-lg font-bold transition-colors">
        Ver Detalhes Completos
      </button>
    </div>
  );
}

/**
 * Seção para alertas recentes
 */
function AlertasSection() {
  return (
    <div className="bg-dashboard-bg-secondary rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-white mb-4">
        🔔 Alertas Recentes
      </h2>
      <p className="text-dashboard-text-secondary mb-4">
        Acompanhe os alertas e eventos dos seus pivôs em tempo real.
      </p>
      <div className="space-y-2 mb-4 max-h-64 overflow-y-auto scrollbar scrollbar-thin scrollbar-thumb-dashboard-accent scrollbar-track-dashboard-bg-tertiary">
        <div className="p-3 bg-red-900 border border-red-700 rounded text-sm">
          <p className="font-medium text-red-100">Sem alertas no momento</p>
          <p className="text-red-200 text-xs mt-1">
            Seus pivôs estão operando normalmente
          </p>
        </div>
      </div>
      <button className="w-full bg-[#08cb7c] hover:bg-[#06a063] text-black px-4 py-2 rounded-lg font-bold transition-colors">
        Ver Histórico de Alertas
      </button>
    </div>
  );
}

export default ClienteDashboard;
