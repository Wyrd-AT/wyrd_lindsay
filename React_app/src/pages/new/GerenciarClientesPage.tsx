/**
 * Página Dedicada: Gerenciar Clientes
 *
 * Exibe:
 * - Estatísticas de Clientes (Total, Ativos)
 * - Lista completa de clientes com filtros
 * - Ações: criar, ver detalhes
 */

import React, { useEffect, useState } from "react";
import { useAuthStore, selectIsActiveUser } from "../../stores/new/authStore";
import Sidebar from "../../components/new/sidebar";
import BodyContent from "../../components/new/body";
import Header from "../../components/new/header";
import PermissionGuard from "../../components/new/PermissionGuard";
import { CreateClienteModal } from "../../components/new/CreateClienteModal";
import EditEntityModal from "../../components/new/EditEntityModal";
import { useAdminClientes } from "../../hooks/new/useAdminClientes";
import { useAdminStats } from "../../hooks/new/useAdminStats";
import { useAdminRevendas } from "../../hooks/new/useAdminRevendas";
import { updateCliente, deleteCliente } from "../../api/new/fastapi-admin";
import type { Cliente } from "../../types/admin";
import { matchesSearchTerm } from "../../utils/search";

interface StatCard {
  label: string;
  value: number;
  subValue: string;
}

interface StatsSectionProps {
  cards: StatCard[];
  loading: boolean;
}

export function GerenciarClientesPage() {
  const authState = useAuthStore();
  const isActiveUser = selectIsActiveUser(authState);
  const isSuperadmin = authState.user?.type === "superadmin";

  const [showCreateCliente, setShowCreateCliente] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const {
    clientes,
    loading: loadingClientes,
    error: clientesError,
    fetchClientes,
  } = useAdminClientes();

  const { allRevendas, loading: loadingRevendas } = useAdminRevendas();

  const {
    stats,
    loading: loadingStats,
    error: statsError,
    fetchStats,
  } = useAdminStats();

  useEffect(() => {
    if (isActiveUser) {
      fetchStats();
      fetchClientes();
    }
  }, [isActiveUser]);

  const handleEditCliente = async (cliente: Cliente) => {
    setEditingCliente(cliente);
  };

  const handleSaveCliente = async (payload: Record<string, any>) => {
    if (!editingCliente?._id) return;
    setSavingEdit(true);
    try {
      await updateCliente(editingCliente._id, payload);
      setEditingCliente(null);
      await fetchClientes();
      await fetchStats();
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteCliente = async (cliente: Cliente) => {
    if (!window.confirm(`Deseja deletar ${cliente.name || cliente.email}?`))
      return;
    await deleteCliente(cliente._id);
    await fetchClientes();
    await fetchStats();
  };

  return (
    <PermissionGuard allowedRoles={["admin", "superadmin"]} requireActive>
      <div className="w-full h-full text-dashboard-text-primary flex bg-dashboard-bg-primary">
        <Sidebar />
        <BodyContent>
          <Header
            page="admin"
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Pesquisar cliente por nome, email ou revenda..."
          />

          <div className="flex items-center justify-between px-4 mb-8">
            <h1 className="text-3xl font-bold">Clientes</h1>
            <button
              onClick={() => {
                fetchStats();
                fetchClientes();
              }}
              disabled={loadingStats || loadingClientes}
              className="bg-dashboard-accent p-2 rounded-lg font-bold hover:bg-dashboard-accent-hover transition disabled:bg-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              {loadingStats || loadingClientes ? "Carregando..." : "Atualizar"}
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
              ]}
              loading={loadingStats}
            />
          </div>

          {/* Lista Completa de Clientes */}
          <div className="px-4 mb-8">
            <ClientesSection
              clientes={clientes}
              loading={loadingClientes}
              searchTerm={searchTerm}
              onCreateClick={() => setShowCreateCliente(true)}
              isSuperadmin={isSuperadmin}
              onEditCliente={handleEditCliente}
              onDeleteCliente={handleDeleteCliente}
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
              revendas={allRevendas}
            />
          )}

          {editingCliente && (
            <EditEntityModal
              entityType="cliente"
              entity={editingCliente}
              isSuperadmin={isSuperadmin}
              isSaving={savingEdit}
              onClose={() => setEditingCliente(null)}
              onSave={handleSaveCliente}
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card, index) => (
          <div
            key={`skeleton-${index}`}
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

/**
 * Seção de Clientes
 */
interface ClientesSectionProps {
  clientes: Cliente[];
  loading: boolean;
  searchTerm: string;
  onCreateClick: () => void;
  isSuperadmin: boolean;
  onEditCliente: (cliente: Cliente) => Promise<void>;
  onDeleteCliente: (cliente: Cliente) => Promise<void>;
}

function ClientesSection({
  clientes,
  loading,
  searchTerm,
  onCreateClick,
  isSuperadmin,
  onEditCliente,
  onDeleteCliente,
}: ClientesSectionProps) {
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredClientes = clientes.filter((c) => {
    const matchesStatus =
      filterStatus === "all" ? true : c.status === filterStatus;

    return (
      matchesStatus &&
      matchesSearchTerm(searchTerm, [
        c.name,
        c.email,
        c.revenda_id,
        c.cnpj_cliente,
        c.cnpj_revenda,
        c.status,
      ])
    );
  });

  return (
    <div className="bg-dashboard-bg-secondary rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-dashboard-text-primary">
          Clientes
        </h2>
        <div className="flex gap-2">
          <button
            onClick={onCreateClick}
            className="px-3 py-1 text-sm bg-dashboard-accent hover:bg-dashboard-accent-hover rounded transition text-white font-bold"
          >
            + Criar Cliente
          </button>
        </div>
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
                : "bg-dashboard-bg-tertiary text-white hover:bg-dashboard-border"
            }`}
          >
            {status === "all" ? "Todos" : "Ativos"}(
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
        <div className="text-center py-8 text-dashboard-text-secondary">
          <p>
            {clientes.length === 0
              ? `Nenhum cliente ${filterStatus !== "all" ? `com status "${filterStatus}"` : ""}`
              : "Nenhum cliente encontrado para os filtros atuais"}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto scrollbar scrollbar-thin scrollbar-thumb-dashboard-accent scrollbar-track-dashboard-bg-tertiary">
          {filteredClientes.map((cliente) => (
            <div
              key={cliente._id}
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
                  {cliente.revenda_id && (
                    <p className="text-xs text-dashboard-text-tertiary mt-1">
                      Revenda: {cliente.revenda_id}
                    </p>
                  )}
                </div>
                <span className="text-xs px-2 py-1 rounded font-bold bg-green-900 text-green-100">
                  Ativo
                </span>
              </div>
              {isSuperadmin && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => onEditCliente(cliente)}
                    className="px-3 py-1 text-xs rounded bg-dashboard-accent text-white font-bold hover:bg-dashboard-accent-hover transition"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => onDeleteCliente(cliente)}
                    className="px-3 py-1 text-xs rounded bg-red-700 text-white font-bold hover:bg-red-600 transition"
                  >
                    Deletar
                  </button>
                </div>
              )}
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

export default GerenciarClientesPage;
