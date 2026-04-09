import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";

import SideBar from "../../components/new/sidebar.jsx";
import BodyContent from "../../components/new/body.jsx";
import SelectExport from "../../components/new/selectExport.jsx";
import AlertHistory from "../../components/new/alertHistory.js";
import MensagemModal from "../../components/new/messageModal.jsx";
import Overview from "../../components/new/Overview.tsx";
import TensionTimeChart from "../../components/new/TensionTimeChart.tsx";

import { getRecentAll } from "../../hooks/new/getRecent.ts";
import { useIrrigadores } from "../../stores/new/dataStoreIrrigadores.js";
import { useAuthStore } from "../../stores/new/authStore.ts";
import { useChangesListener } from "../../hooks/new/useChangesListener";
import { Irrigador } from "../../helpers/helperOverview.tsx";
import type { Period } from "../../types/tension";

const periodOptions: { value: Period; label: string }[] = [
  { value: "last24h", label: "24 h" },
  { value: "last7d", label: "7 dias" },
  { value: "last30d", label: "30 dias" },
];

export default function MaquinaRevenda() {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const { machineId } = useParams();

  const cnpjCliente = user?.cnpj ?? "";
  const userType = user?.type ?? "cliente";
  const irrigadores = useIrrigadores(cnpjCliente, userType);

  const [flash, setFlash] = useState(false);
  const [isMensagemOpen, setIsMensagemOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("last24h");
  const [errorData, setErrorData] = useState<string | null>(null);

  // Ticks que disparam refresh nos componentes filhos sem re-criar listeners
  const [overviewRefreshTick, setOverviewRefreshTick] = useState(0);
  const [alertRefreshTick, setAlertRefreshTick] = useState(0);

  useEffect(() => {
    if (!isAuthenticated || !cnpjCliente || !user) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  const selectedDoc = useMemo<Irrigador | undefined>(() => {
    const list = irrigadores as Irrigador[];
    const byId = list.find(
      (doc: any) => String(doc._id || doc.id) === String(machineId),
    );
    if (byId) return byId;
    return list.find((doc) => String(doc.codigo) === String(machineId));
  }, [irrigadores, machineId]);

  const apiIrrigadorId = useMemo(() => {
    const docAny = selectedDoc as any;
    if (docAny?._id) return docAny._id as string;
    if (docAny?.id) return docAny.id as string;
    if (typeof machineId === "string" && machineId.startsWith("irrigador:")) {
      return machineId;
    }
    return null;
  }, [selectedDoc, machineId]);

  // Fonte única de equipamentos: apenas via API (sem race condition com selectedDoc)
  const [equipamentos, setEquipamentos] = useState<string[]>([
    "Painel 1",
    "Painel 2",
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!apiIrrigadorId) return;
    (async () => {
      try {
        const all = await getRecentAll(String(apiIrrigadorId));
        const eq = all?.overview?.equipamentos;
        if (!cancelled && Array.isArray(eq) && eq.length >= 2) {
          setEquipamentos(eq as string[]);
        }
      } catch {
        // mantém o fallback ["Painel 1", "Painel 2"]
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiIrrigadorId]);

  // Listener único de mudanças com backoff adaptativo interno
  useChangesListener({
    onChange: (changes) => {
      const relevant = changes.some((c) =>
        c.id.includes(String(apiIrrigadorId)),
      );
      if (relevant) {
        setOverviewRefreshTick((t) => t + 1);
        setAlertRefreshTick((t) => t + 1);
      }
    },
    irrigadorId: apiIrrigadorId ?? undefined,
    pause: !apiIrrigadorId,
    adaptiveBackoff: true,
    useLongpoll: true,
  });

  const handleMachineChange = (id: string) => {
    setFlash(true);
    navigate(`/maquina/${id}`);
    setTimeout(() => setFlash(false), 200);
  };

  // Se a rota veio por código (antigo), redireciona para o _id quando possível
  useEffect(() => {
    if (!machineId || String(machineId).startsWith("irrigador:")) return;
    const list = irrigadores as Irrigador[];
    const matches = list.filter(
      (doc: any) => String(doc.codigo) === String(machineId),
    );
    if (matches.length === 1) {
      const id = (matches[0] as any)?._id || (matches[0] as any)?.id;
      if (id) navigate(`/maquina/${id}`, { replace: true });
    } else if (matches.length > 1) {
      setErrorData(
        "Existe mais de um pivô com esse código. Abra o pivô pelo _id.",
      );
    }
  }, [machineId, irrigadores, navigate]);

  const docAny = selectedDoc as any;
  const displayName =
    docAny?.irrigador ?? docAny?.nome ?? `Pivô ${docAny?.codigo ?? machineId}`;

  return (
    <div
      className={`w-full min-h-screen text-white flex bg-dashboard-bg-primary
        transition-opacity duration-200
        ${flash ? "opacity-50" : "opacity-100"}`}
      key={machineId}
    >
      <SideBar />

      <BodyContent>
        {errorData && (
          <div className="text-center py-2 text-red-400 text-sm">
            {errorData}
          </div>
        )}
        <SelectExport
          selectedMachine={machineId}
          getDisplayName={() => displayName}
          redirectBase="/maquina"
          onMachineChange={handleMachineChange}
          onclick_details={() => {}}
          onExport={() => {}}
          onMessage={() => setIsMensagemOpen(true)}
        />

        <Overview
          pivoId={selectedDoc?.codigo ?? String(machineId)}
          irrigadorId={apiIrrigadorId ?? undefined}
          cnpjCliente={cnpjCliente}
          email={user?.email}
          equipamentoNames={equipamentos}
          externalRefreshTick={overviewRefreshTick}
        />

        {apiIrrigadorId ? (
          <>
            <div className="flex flex-wrap gap-3 items-center mt-4 py-4 px-2 bg-[#222222] rounded-t-lg">
              <div className="flex items-center">
                <label htmlFor="periodSelect" className="mr-2 text-white">
                  Período:
                </label>
                <select
                  id="periodSelect"
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value as Period)}
                  className="bg-gray-700 text-white p-0.5 rounded"
                >
                  {periodOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <TensionTimeChart
              irrigadorId={apiIrrigadorId}
              period={selectedPeriod}
              limit={1000}
              height={400}
              title={`Tensão pelo Tempo - ${displayName}`}
              equipmentNames={equipamentos}
            />
            <AlertHistory
              machineId={machineId as string}
              irrigadorId={apiIrrigadorId}
              pivoName={docAny?.irrigador}
              equipamentos={equipamentos}
              externalRefreshTick={alertRefreshTick}
            />
          </>
        ) : (
          <div className="mt-4 text-sm text-gray-400">
            Carregando dados do pivô...
          </div>
        )}
      </BodyContent>

      <MensagemModal
        isOpen={isMensagemOpen}
        onClose={() => setIsMensagemOpen(false)}
        selectedMachine={machineId}
      />
    </div>
  );
}
