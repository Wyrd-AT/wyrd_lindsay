/**
 * Página Dedicada: Gerenciar Pivôs
 *
 * Exibe:
 * - Estatísticas de Pivôs (Total, Ativos, Alarmados, Manutenção)
 * - Status de todos os pivôs do sistema
 * - Filtros por status
 */

import React, { useEffect, useMemo, useState } from "react";
import { useAuthStore, selectIsActiveUser } from "../../stores/new/authStore";
import Sidebar from "../../components/new/sidebar";
import BodyContent from "../../components/new/body";
import Header from "../../components/new/header";
import PermissionGuard from "../../components/new/PermissionGuard";
import PivosSection from "../../components/new/PivosSection";
import { ModalIrrigador } from "../../components/new/modalNewIrrigador";
import { useDataStoreIrrigadores } from "../../stores/new/dataStoreIrrigadores";
import apiClient from "../../api/new/apiClient";

interface StatCard {
  label: string;
  value: number;
  subValue: string;
}

interface StatsSectionProps {
  cards: StatCard[];
  loading: boolean;
}

export function GerenciarPivosPage() {
  const authState = useAuthStore();
  const isActiveUser = selectIsActiveUser(authState);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  const irrigadores = useDataStoreIrrigadores((s) => s.irrigadores);
  const loadingIrrigadores = useDataStoreIrrigadores((s) => s.isLoading);
  const loadingRecentIrrigadores = useDataStoreIrrigadores(
    (s) => s.isLoadingRecent,
  );
  const irrigadoresError = useDataStoreIrrigadores((s) => s.error);
  const fetchIrrigadores = useDataStoreIrrigadores((s) => s.fetchIrrigadores);
  const fetchRecentIrrigadores = useDataStoreIrrigadores(
    (s) => s.fetchRecentIrrigadores,
  );
  const updateIrrigador = useDataStoreIrrigadores((s) => s.updateIrrigador);
  const removeIrrigador = useDataStoreIrrigadores((s) => s.removeIrrigador);

  useEffect(() => {
    if (isActiveUser) {
      fetchIrrigadores();
      const t = setTimeout(() => {
        fetchRecentIrrigadores();
      }, 800);
      return () => clearTimeout(t);
    }
  }, [isActiveUser, fetchIrrigadores, fetchRecentIrrigadores]);

  useEffect(() => {
    if (!isActiveUser) return;
    const timer = setInterval(() => {
      fetchIrrigadores({ force: true });
      fetchRecentIrrigadores({ force: true });
    }, 300000);
    return () => clearInterval(timer);
  }, [isActiveUser, fetchIrrigadores, fetchRecentIrrigadores]);

  const pivoStats = useMemo(() => {
    const total = irrigadores.length;
    const active = irrigadores.filter((p: any) => p.ativo === true).length;
    const alarmado = irrigadores.filter((p: any) => {
      const count = p.alarm_count ?? 0;
      return Number(count) > 0;
    }).length;
    const maintenance = irrigadores.filter(
      (p: any) => p.status === "maintenance",
    ).length;
    return { total, active, alarmado, maintenance };
  }, [irrigadores]);

  return (
    <PermissionGuard allowedRoles={["admin", "superadmin", "revenda"]} requireActive>
      <div className="w-full h-full text-dashboard-text-primary flex bg-dashboard-bg-primary">
        <Sidebar />
        <BodyContent>
          <Header
            page="admin"
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Pesquisar pivô por nome, código ou dono..."
          />

          <div className="flex items-center justify-between px-4 mb-8">
            <h1 className="text-3xl font-bold">Pivôs</h1>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-dashboard-accent p-2 rounded-lg font-bold hover:bg-dashboard-accent-hover transition"
              >
                + Criar Pivô
              </button>
              <button
                onClick={() => {
                  fetchStats();
                }}
                className="bg-dashboard-bg-tertiary border border-dashboard-border p-2 rounded-lg font-bold hover:bg-dashboard-border transition"
              >
                Atualizar
              </button>
            </div>
          </div>

          {/* Erros globais */}
          {irrigadoresError && (
            <div className="mx-4 mb-6 p-4 bg-red-900 border border-red-700 rounded-lg text-red-100">
              <p className="font-medium">Erro ao carregar dados:</p>
              <p className="text-sm">{irrigadoresError}</p>
            </div>
          )}

          {/* Stats Section */}
          <div className="px-4 mb-8">
            <StatsSection
              cards={[
                {
                  label: "Total de Pivôs",
                  value: pivoStats.total,
                  subValue: `${pivoStats.active} ativos`,
                },
                {
                  label: "Pivôs Alarmados",
                  value: pivoStats.alarmado,
                  subValue: `${pivoStats.maintenance} em manutenção`,
                },
              ]}
              loading={loadingIrrigadores}
            />
          </div>
          {/* Pivôs Section */}
          <div className="px-4 mb-8">
            <div className="bg-dashboard-bg-secondary rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-dashboard-text-primary mb-4">
                Monitoramento de Pivôs
              </h2>
              <PivosSection
                searchTerm={searchTerm}
                pivos={irrigadores as any}
                loading={loadingIrrigadores}
                loadingRecent={loadingRecentIrrigadores}
                error={irrigadoresError}
                onRefresh={fetchIrrigadores}
                onLoadFullPivo={async (pivo) => {
                  const response = await apiClient.get(`/pivos/${pivo._id}`);
                  return response.data?.pivo ?? pivo;
                }}
                onUpdatePivo={async (pivoId, pivoData) => {
                  // Pivô é documento de irrigador no CouchDB; edição direta evita roundtrip no backend.
                  await updateIrrigador(pivoId, pivoData);
                  await fetchIrrigadores({ force: true });
                  await fetchRecentIrrigadores({ force: true });
                }}
                onDeletePivo={async (pivoId) => {
                  // Deleção direta do documento irrigador.
                  await removeIrrigador(pivoId);
                  await fetchIrrigadores({ force: true });
                  await fetchRecentIrrigadores({ force: true });
                }}
              />
            </div>
          </div>
          {showCreateModal && (
            <ModalIrrigador
              closeModal={() => setShowCreateModal(false)}
              onSuccess={() => {
                setShowCreateModal(false);
                fetchIrrigadores();
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

export default GerenciarPivosPage;
