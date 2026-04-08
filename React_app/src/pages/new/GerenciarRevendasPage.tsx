/**
 * Página Dedicada: Gerenciar Revendas
 *
 * Exibe:
 * - Estatísticas de Revendas (Total, Ativas)
 * - Lista completa de revendas com filtros
 * - Ação: criar revenda
 */

import React, { useEffect, useState } from "react";
import { useAuthStore, selectIsActiveUser } from "../../stores/new/authStore";
import Sidebar from "../../components/new/sidebar";
import BodyContent from "../../components/new/body";
import Header from "../../components/new/header";
import PermissionGuard from "../../components/new/PermissionGuard";
import { CreateRevendaModal } from "../../components/new/CreateRevendaModal";
import EditEntityModal from "../../components/new/EditEntityModal";
import { useAdminRevendas } from "../../hooks/new/useAdminRevendas";
import { useAdminStats } from "../../hooks/new/useAdminStats";
import { updateRevenda, deleteRevenda } from "../../api/new/fastapi-admin";
import type { Revenda } from "../../types/admin";
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

export function GerenciarRevendasPage() {
  const authState = useAuthStore();
  const isActiveUser = selectIsActiveUser(authState);
  const isSuperadmin = authState.user?.type === "superadmin";

  const [showCreateRevenda, setShowCreateRevenda] = useState(false);
  const [editingRevenda, setEditingRevenda] = useState<Revenda | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const {
    allRevendas,
    loading: loadingRevendas,
    error: revendasError,
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
      fetchStats();
      fetchAllRevendas();
    }
  }, [isActiveUser]);

  const handleEditRevenda = async (revenda: Revenda) => {
    setEditingRevenda(revenda);
  };

  const handleSaveRevenda = async (payload: Record<string, any>) => {
    const revendaDocId = editingRevenda?.doc_id ?? editingRevenda?.id ?? editingRevenda?._id;
    if (!revendaDocId) return;
    setSavingEdit(true);
    try {
      await updateRevenda(revendaDocId, payload);
      setEditingRevenda(null);
      await fetchAllRevendas();
      await fetchStats();
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteRevenda = async (revenda: Revenda) => {
    if (!window.confirm(`Deseja deletar ${revenda.name || revenda.email}?`))
      return;
    const revendaDocId = revenda.doc_id ?? revenda.id ?? revenda._id;
    await deleteRevenda(revendaDocId!);
    await fetchAllRevendas();
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
            searchPlaceholder="Pesquisar revenda por nome, email ou CNPJ..."
          />

          <div className="flex items-center justify-between px-4 mb-8">
            <h1 className="text-3xl font-bold">Revendas</h1>
            <button
              onClick={() => {
                fetchStats();
                fetchAllRevendas();
              }}
              disabled={loadingStats || loadingRevendas}
              className="bg-dashboard-accent p-2 rounded-lg font-bold hover:bg-dashboard-accent-hover transition disabled:bg-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              {loadingStats || loadingRevendas ? "Carregando..." : "Atualizar"}
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
              ]}
              loading={loadingStats}
            />
          </div>

          {/* Lista Completa de Revendas */}
          <div className="px-4 mb-8">
            <RevendasSection
              revendas={allRevendas}
              loading={loadingRevendas}
              searchTerm={searchTerm}
              onCreateClick={() => setShowCreateRevenda(true)}
              isSuperadmin={isSuperadmin}
              onEditRevenda={handleEditRevenda}
              onDeleteRevenda={handleDeleteRevenda}
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

          {editingRevenda && (
            <EditEntityModal
              entityType="revenda"
              entity={editingRevenda}
              isSuperadmin={isSuperadmin}
              isSaving={savingEdit}
              onClose={() => setEditingRevenda(null)}
              onSave={handleSaveRevenda}
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
 * Seção de Revendas
 */
interface RevendasSectionProps {
  revendas: Revenda[];
  loading: boolean;
  searchTerm: string;
  onCreateClick: () => void;
  isSuperadmin: boolean;
  onEditRevenda: (revenda: Revenda) => Promise<void>;
  onDeleteRevenda: (revenda: Revenda) => Promise<void>;
}

function RevendasSection({
  revendas,
  loading,
  searchTerm,
  onCreateClick,
  isSuperadmin,
  onEditRevenda,
  onDeleteRevenda,
}: RevendasSectionProps) {
  const filteredRevendas = revendas.filter((revenda) =>
    matchesSearchTerm(searchTerm, [
      revenda.name,
      revenda.email,
      revenda.cnpj_revenda,
      revenda.status,
      revenda.id ?? revenda._id,
    ]),
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
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dashboard-accent"></div>
        </div>
      ) : filteredRevendas.length === 0 ? (
        <div className="text-center py-8 text-dashboard-text-secondary">
          <p>
            {revendas.length === 0
              ? "Nenhuma revenda cadastrada"
              : "Nenhuma revenda encontrada para a busca atual"}
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto scrollbar scrollbar-thin scrollbar-thumb-dashboard-accent scrollbar-track-dashboard-bg-tertiary">
          {filteredRevendas.map((revenda, idx) => (
            <div
              key={revenda.id ?? revenda._id ?? revenda.email ?? `revenda-${idx}`}
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
                  {revenda.cnpj_revenda && (
                    <p className="text-xs text-dashboard-text-tertiary mt-1">
                      CNPJ: {revenda.cnpj_revenda}
                    </p>
                  )}
                </div>
                <span className="text-xs px-2 py-1 rounded font-bold bg-green-900 text-green-100">
                  Ativa
                </span>
              </div>
              {isSuperadmin && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => onEditRevenda(revenda)}
                    className="px-3 py-1 text-xs rounded bg-dashboard-accent text-white font-bold hover:bg-dashboard-accent-hover transition"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => onDeleteRevenda(revenda)}
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
    </div>
  );
}

export default GerenciarRevendasPage;
