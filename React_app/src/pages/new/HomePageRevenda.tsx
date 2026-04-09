// src/pages/HomePageRevenda.tsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import BodyContent from "../../components/new/body";
import Header from "../../components/new/header";
import Sidebar from "../../components/new/sidebar";
import IrrigadorCard from "../../components/new/irrigadorCard";
import { ModalIrrigador as ModalIrrigadorBase } from "../../components/new/modalNewIrrigador";

const ModalIrrigador = ModalIrrigadorBase as React.FC<{
  closeModal: () => void;
  onSuccess?: () => void;
}>;

import {
  useIrrigadores,
  useDataStoreIrrigadores,
} from "../../stores/new/dataStoreIrrigadores";
import { useAuthStore } from "../../stores/new/authStore";

import { getRecentAll } from "../../hooks/new/getRecent";
import { getCurrentUser } from "../../api/new/fastapi-auth";
import { useChangesListener } from "../../hooks/new/useChangesListener";
import { matchesSearchTerm } from "../../utils/search";

export default function HomePageRevenda() {
  const navigate = useNavigate();

  const { isAuthenticated, user, updateUser } = useAuthStore();
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  // Se não tem CNPJ no user (sessão antiga), buscar via API
  useEffect(() => {
    if (user?.cnpj) return;
    if (!user?.type) return;
    let cancelled = false;
    (async () => {
      try {
        const current = await getCurrentUser();
        if (cancelled || !current) return;
        if (current.cnpj) updateUser({ cnpj: current.cnpj });
      } catch {
        // ignora
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.cnpj, user?.type, updateUser]);

  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Lista de pivôs com alarm_count e last_alert_date já embutidos (backend ordena por alarme)
  const irrigadores = useIrrigadores();
  const loadingIrrigadores = useDataStoreIrrigadores((s) => s.isLoading);
  const fetchIrrigadores = useDataStoreIrrigadores((s) => s.fetchIrrigadores);
  const fetchRecentIrrigadores = useDataStoreIrrigadores(
    (s) => s.fetchRecentIrrigadores,
  );
  const loadingRecentIrrigadores = useDataStoreIrrigadores(
    (s) => s.isLoadingRecent,
  );
  const recentOverrides = useDataStoreIrrigadores((s) => s.recentOverrides);
  const updateRecentForIrrigador = useDataStoreIrrigadores((s) => s.updateRecentForIrrigador);

  // Listener único: ao detectar mudança, rebusca apenas o pivô alterado (1 request)
  useChangesListener({
    onChange: async (changes) => {
      for (const change of changes) {
        // IDs esperados: "sw_recente::irrigador:xxx" ou "recente_sw::CODIGO"
        const parts = change.id.split("::");
        if (parts.length < 2) continue;
        const key = parts[parts.length - 1];

        // Resolve chave → _id (prioriza _id, senão busca por codigo)
        let irrigadorId = key;
        if (!irrigadorId.startsWith("irrigador:")) {
          const match = irrigadores.find(
            (doc: any) => String(doc.codigo) === String(key),
          );
          if (match?._id) irrigadorId = String(match._id);
        }
        if (!irrigadorId.startsWith("irrigador:")) continue;

        try {
          const all = await getRecentAll(irrigadorId);
          if (all?.overview) {
            updateRecentForIrrigador(irrigadorId, all.overview);
          }
        } catch {
          // ignora falhas individuais
        }
      }
    },
    adaptiveBackoff: true,
    useLongpoll: true,
    pause: !isAuthenticated,
  });

  // Filtro por busca + ordenação: recentOverrides tem prioridade sobre dado inicial do backend
  const filteredIrrigadores = useMemo(() => {
    const filtered = irrigadores.filter((doc: any) =>
      matchesSearchTerm(searchTerm, [
        doc.irrigador,
        doc.nome,
        doc.codigo,
        doc.nome_cliente,
        doc.nome_revenda,
        doc.nome_admin,
        doc.cnpj_cliente,
        doc.cnpj_revenda,
        doc.cnpj_admin,
      ]),
    );

    // Ordena por alarm_count DESC (recentOverrides tem prioridade)
    return filtered.sort((a: any, b: any) => {
      const id_a = String(a._id || a.id || "");
      const id_b = String(b._id || b.id || "");
      const aCount = recentOverrides[id_a]?.alarm_count ?? a.alarm_count ?? 0;
      const bCount = recentOverrides[id_b]?.alarm_count ?? b.alarm_count ?? 0;
      return bCount - aCount;
    });
  }, [irrigadores, searchTerm, recentOverrides]);

  useEffect(() => {
    if (!irrigadores.length) return;
    const sample = irrigadores.slice(0, 3).map((doc: any) => {
      const id = String(doc._id || doc.id || "");
      const recent = { ...doc, ...(recentOverrides[id] || {}) };
      return {
        id,
        display_name: recent.display_name ?? recent.nome ?? recent.irrigador,
        alarm_count: recent.alarm_count,
        last_sw_at: recent.last_sw_at,
        last_tensao_at: recent.last_tensao_at,
        last_data_at: recent.last_data_at,
        last_alert_date: recent.last_alert_date,
      };
    });
    console.log("[HomePageRevenda] sample pivos:", sample);
  }, [irrigadores, recentOverrides]);

  return (
    <div className="w-full min-h-screen text-white flex bg-dashboard-bg-primary">
      <Sidebar />
      <BodyContent>
        <Header
          page="home"
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Pesquisar pivô, cliente, revenda ou código..."
        />

        <div className="flex items-center justify-between px-4 mb-4">
          <h1 className="text-2xl font-bold">
            {user?.type === "admin" || user?.type === "superadmin"
              ? "Todos os Pivôs"
              : "Pivôs"}
          </h1>
          {loadingRecentIrrigadores && (
            <span className="text-sm text-gray-400">
              Atualizando status recente...
            </span>
          )}
        </div>

        <div
          className="w-full grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3
                     overflow-auto scrollbar scrollbar-thin scrollbar-thumb-red-500
                     scrollbar-track-gray-800 py-4 gap-5 px-4"
        >
          {loadingIrrigadores ? (
            <div className="text-gray-400">Carregando pivôs...</div>
          ) : filteredIrrigadores.length > 0 ? (
            filteredIrrigadores.map((doc: any) => {
              const id = String(doc._id || doc.id || "");
              const recent = { ...doc, ...(recentOverrides[id] || {}) };
              const alertCount = recent.alarm_count ?? 0;
              const lastAlertDate =
                recent.last_data_at ?? recent.last_alert_date ?? "—";

              return (
                <IrrigadorCard
                  key={doc._id}
                  machineId={doc._id || doc.id || doc.codigo}
                  displayName={
                    doc.display_name ?? doc.irrigador ?? doc.nome ?? doc.codigo ?? "Pivô"
                  }
                  nomeCliente={doc.nome_cliente}
                  nomeRevenda={doc.nome_revenda}
                  nomeAdmin={doc.nome_admin}
                  cnpjCliente={doc.cnpj_cliente}
                  cnpjRevenda={doc.cnpj_revenda}
                  cnpjAdmin={doc.cnpj_admin}
                  revendaId={doc.revenda_id}
                  ownerId={doc.owner_id}
                  userType={user?.type}
                  alertCount={alertCount}
                  lastAlertDate={lastAlertDate}
                  loadingRecent={loadingRecentIrrigadores}
                />
              );
            })
          ) : (
            <div className="text-gray-400">
              {irrigadores.length === 0
                ? "Nenhum pivô cadastrado."
                : "Nenhum pivô encontrado para a busca atual."}
            </div>
          )}
        </div>

        {isModalOpen && (
          <ModalIrrigador
            closeModal={() => setIsModalOpen(false)}
            onSuccess={() => {
              fetchIrrigadores({ force: true });
              fetchRecentIrrigadores({ force: true });
            }}
          />
        )}
      </BodyContent>
    </div>
  );
}
