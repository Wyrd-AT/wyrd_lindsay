/// <reference types="vite/client" />
/**
 * Página Dedicada: Gerenciar Clientes (Revenda)
 *
 * - Role: revenda (nunca exibir "Revendas Pendentes" aqui; só "Clientes Pendentes")
 * - Usa useRevendaClientes e useRevendaStats
 * - Fila de aprovação: ClientePendingApprovals (clientes aguardando aprovação da revenda)
 * - Criar cliente auto-vincula à própria revenda
 */

import { useEffect, useState } from "react";
import { useAuthStore, selectIsActiveUser } from "../../stores/new/authStore";
import Sidebar from "../../components/new/sidebar";
import BodyContent from "../../components/new/body";
import Header from "../../components/new/header";
import PermissionGuard from "../../components/new/PermissionGuard";
import { ClientePendingApprovals } from "../../components/new/ClientePendingApprovals";
import { CreateClienteModal } from "../../components/new/CreateClienteModal";
import { useRevendaClientes } from "../../hooks/new/useRevendaClientes";
import { useRevendaStats } from "../../hooks/new/useRevendaStats";
import type { Cliente } from "../../types/admin";

interface StatCard {
  label: string;
  value: number;
  subValue: string;
}

interface StatsSectionProps {
  cards: StatCard[];
  loading: boolean;
}

export function GerenciarClientesRevendaPage() {
  const authState = useAuthStore();
  const isActiveUser = selectIsActiveUser(authState);

  const [showCreateCliente, setShowCreateCliente] = useState(false);

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

  useEffect(() => {
    if (isActiveUser) {
      fetchStats();
      fetchClientes();
      fetchPendingClientes();
    }
  }, [isActiveUser]);

  const handleRefresh = () => {
    fetchStats();
    fetchClientes();
    fetchPendingClientes();
  };

  return (
    <PermissionGuard allowedRoles={["revenda"]} requireActive>
      <div className="w-full h-full text-dashboard-text-primary flex bg-dashboard-bg-primary">
        <Sidebar />
        <BodyContent>
          <Header page="revenda" />

          <div className="flex items-center justify-between px-4 mb-8">
            <h1 className="text-3xl font-bold">Clientes</h1>
            <button
              onClick={handleRefresh}
              className="bg-dashboard-accent p-2 rounded-lg font-bold hover:bg-dashboard-accent-hover transition"
            >
              Atualizar
            </button>
          </div>

          {/* Erros globais */}
          {(clientesError || statsError) && (
            <div className="mx-4 mb-6 p-4 bg-red-900 border border-red-700 rounded-lg text-red-100">
              <p className="font-medium">Erro ao carregar dados:</p>
              <p className="text-sm">{clientesError || statsError}</p>
            </div>
          )}

          {/* Stats Section */}
          <div className="px-4 mb-8">
            <StatsSection
              cards={[
                {
                  label: "Total de Clientes",
                  value: stats?.totalClientes || 0,
                  subValue: `${stats?.activeClientes || 0} ativos`,
                },
                {
                  label: "Clientes Pendentes",
                  value: stats?.pendingClientes || 0,
                  subValue: "Aguardando aprovação",
                },
              ]}
              loading={loadingStats}
            />
          </div>

          {/* Fila de Aprovações de Clientes (revenda aprova seus clientes; não usar RevendaPendingApprovals) */}
          <div className="px-4 mb-8">
            <h2 className="text-xl font-bold text-dashboard-text-primary mb-4">
              Clientes Pendentes
            </h2>
            <ClientePendingApprovals onApprovalChange={handleRefresh} />
          </div>

          {/* Lista de Clientes */}
          <div className="px-4 mb-8">
            <ClientesSection
              clientes={clientes}
              loading={loadingClientes}
              onRefresh={fetchClientes}
              onCreateClick={() => setShowCreateCliente(true)}
            />
          </div>

          {/* Modal Criar Cliente */}
          {showCreateCliente && (
            <CreateClienteModal
              closeModal={() => setShowCreateCliente(false)}
              onSuccess={() => {
                setShowCreateCliente(false);
                fetchClientes();
                fetchStats();
              }}
              showRevendaField={false}
            />
          )}
        </BodyContent>
      </div>
    </PermissionGuard>
  );
}

function StatsSection({ cards, loading }: StatsSectionProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-24 bg-dashboard-bg-secondary animate-pulse rounded-lg"
          />
        ))}
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
          Clientes
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onCreateClick}
            className="px-3 py-1 text-sm bg-dashboard-accent hover:bg-dashboard-accent-hover rounded transition text-black font-bold"
          >
            + Criar Cliente
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-1 text-sm bg-dashboard-bg-tertiary hover:bg-dashboard-border disabled:opacity-50 rounded transition text-white"
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
              ? "Todos"
              : status === "active"
                ? "Ativos"
                : status === "pending"
                  ? "Pendentes"
                  : "Rejeitados"}
            &nbsp;(
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dashboard-accent" />
        </div>
      ) : filteredClientes.length === 0 ? (
        <div className="text-center py-8 text-dashboard-text-secondary">
          <p>
            Nenhum cliente
            {filterStatus !== "all" ? ` com status "${filterStatus}"` : ""}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto scrollbar scrollbar-thin scrollbar-thumb-dashboard-accent scrollbar-track-dashboard-bg-tertiary">
          {filteredClientes.map((cliente, idx) => (
            <div
              key={cliente._id ?? cliente.email ?? `cliente-${idx}`}
              className="border border-dashboard-border rounded-lg p-4 hover:bg-dashboard-border transition bg-dashboard-bg-tertiary"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-dashboard-text-primary">
                    {cliente.name}
                  </h3>
                  <p className="text-sm text-dashboard-text-secondary mt-1">
                    {cliente.email}
                  </p>
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
                    ? "Ativo"
                    : cliente.status === "pending"
                      ? "Pendente"
                      : "Rejeitado"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GerenciarClientesRevendaPage;
