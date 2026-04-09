// app/(pivo)/[pivoId]/overview.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import clsx from "clsx";
import { getRecentAll } from "../../hooks/new/getRecent";
import { StatusCard } from "./statusCard";
import {
  DeviceCard,
  OverviewProps,
  sendCommand,
} from "../../helpers/helperOverview";
import { useWhatsappPerIrrigador } from "../../hooks/new/useWhatsappPerIrrigador";
import {
  useAuthStore,
  selectCanResolveAlerts,
  selectCanToggleAlarm,
} from "../../stores/new/authStore";

export default function Overview({
  pivoId,
  irrigadorId,
  cnpjCliente,
  email,
  equipamentoNames,
  externalRefreshTick,
}: OverviewProps) {
  const effectiveIrrigadorId = irrigadorId ?? null;
  const [loading, setLoading] = useState(false);
  const [responseMsg, setResponseMsg] = useState("");
  const [localManOverride, setLocalManOverride] = useState<null | boolean>(
    null,
  );
  const [localSireneOverride, setLocalSireneOverride] = useState<
    null | boolean
  >(null);
  const [isSaving, setIsSaving] = useState(false);

  const canResolveAlerts = useAuthStore(selectCanResolveAlerts);
  const canToggleAlarm = useAuthStore(selectCanToggleAlarm);
  const user = useAuthStore((state) => state.user);

  /* ----------------- WhatsApp por irrigador ----------------- */
  const {
    msgEnabled,
    callEnabled,
    updateConfig, // Atualização direta
    loading: notificationLoading,
  } = useWhatsappPerIrrigador(
    effectiveIrrigadorId,
    email,
    user?.phone_number,
  ); // [NOVO] Passa o telefone do authStore

  /* ----------------- Carregar snapshots via getRecentAll ----------------- */
  const [overviewCards, setOverviewCards] = useState<DeviceCard[]>([]);
  const [statusSwAt, setStatusSwAt] = useState<string | null>(null);
  const [tensaoAt, setTensaoAt] = useState<string | null>(null);
  const [remoteMaintenance, setRemoteMaintenance] = useState<boolean>(false);
  const [remoteSirene, setRemoteSirene] = useState<boolean>(false);

  // Função para carregar dados do CouchDB
  const loadData = useCallback(async () => {
    if (!effectiveIrrigadorId) return;

    try {
      const all = await getRecentAll(String(effectiveIrrigadorId));
      const ov = all.overview || {};
      if (Array.isArray(ov.cards)) {
        setOverviewCards(ov.cards as DeviceCard[]);
      } else {
        setOverviewCards([]);
      }
      setStatusSwAt(ov.status_sw_at || null);
      setTensaoAt(ov.tensao_at || null);
      setRemoteMaintenance(!!ov.is_in_maintenance);
      setRemoteSirene(!!ov.is_sirene_active);
    } catch (e: any) {
      console.error(e?.message ?? "Falha ao carregar snapshots recentes");
    }
  }, [effectiveIrrigadorId]);

  const equipamentoByCode = useMemo(() => {
    if (!Array.isArray(equipamentoNames) || !equipamentoNames.length) return {};
    return Object.fromEntries(
      Array.from({ length: 13 }, (_, i) => {
        const code = String(i + 1).padStart(2, "0"); // "01".."13"
        const idx = i + 2; // posições 2..14 em equipamentos[]
        return [code, equipamentoNames[idx] || ""];
      }),
    );
  }, [equipamentoNames]);

  const allowedMonitorCodes = useMemo(() => {
    return new Set(
      Object.entries(equipamentoByCode)
        .filter(([, nome]) => String(nome || "").trim() !== "")
        .map(([code]) => code),
    );
  }, [equipamentoByCode]);

  const getMonitorCode = useCallback(
    (title: string) => {
      const norm = (v: any) => String(v || "").trim().toLowerCase();
      const titleNorm = norm(title);
      if (!titleNorm) return "";
      const entries = Object.entries(equipamentoByCode);
      const exact = entries.find(([, nome]) => norm(nome) === titleNorm);
      if (exact) return exact[0];
      const fuzzy = entries.find(([, nome]) => {
        const n = norm(nome);
        return n && (titleNorm.includes(n) || n.includes(titleNorm));
      });
      return fuzzy ? fuzzy[0] : "";
    },
    [equipamentoByCode],
  );

  const getMonitorCodeFromId = useCallback((id: string) => {
    const m = String(id || "").match(/(\d{2})$/);
    return m ? m[1] : "";
  }, []);

  const isPanelCard = useCallback((c: DeviceCard) => {
    const title = String(c?.title || "").toLowerCase();
    const id = String(c?.id || "").toLowerCase();
    return title.includes("painel") || id.includes("painel_1") || id.includes("painel_2");
  }, []);

  // Carrega dados inicialmente
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh disparado pelo listener centralizado em MachineRevenda
  useEffect(() => {
    if (externalRefreshTick && externalRefreshTick > 0) {
      loadData();
    }
  }, [externalRefreshTick, loadData]);

  /* ----------------- manutenção & sirene ----------------- */
  const isInMaintenance = useMemo(
    () => (localManOverride !== null ? localManOverride : remoteMaintenance),
    [localManOverride, remoteMaintenance],
  );

  const isSireneActive = useMemo(
    () => (localSireneOverride !== null ? localSireneOverride : remoteSirene),
    [localSireneOverride, remoteSirene],
  );

  useEffect(() => {
    setLocalSireneOverride(null);
  }, [remoteSirene]);

  /* ----------------- ações & modal ----------------- */
  const handleSolicitarStatus = () => {
    try {
      sendCommand(
        "update",
        "Status solicitado com sucesso!",
        "Falha ao solicitar status.",
        pivoId,
        setResponseMsg,
        setLoading,
        loading,
      );
    } finally {
      setIsSaving(false);
    }
  };
  const handleToggleSirene = async () => {
    const current = isSireneActive;
    const next = !current;
    setLocalSireneOverride(next);
    setIsSaving(true);
    try {
      const successMsg = next
        ? "Sirene disparada com sucesso!"
        : "Sirene desativada com sucesso!";
      const failureMsg = next
        ? "Falha ao disparar sirene."
        : "Falha ao desativar sirene.";
      await sendCommand(
        "sirene",
        successMsg,
        failureMsg,
        pivoId,
        setResponseMsg,
        setLoading,
        loading,
      );
    } catch (error) {
      setLocalSireneOverride(current);
    } finally {
      setIsSaving(false);
    }
  };
  const handleToggleManutencao = async () => {
    const current = isInMaintenance;
    const next = !current;
    setLocalManOverride(next);
    setIsSaving(true);
    try {
      await sendCommand(
        "man",
        "Modo alternado!",
        "Falha ao alternar.",
        pivoId,
        setResponseMsg,
        setLoading,
        loading,
      );
    } catch {
      setLocalManOverride(current);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="bg-[#222] text-white p-4 rounded-md w-full mt-4">
        <summary className="flex items-center justify-between cursor-pointer font-semibold text-lg mb-2 select-none">
          <div className="flex items-center gap-2">
            <span className="uppercase">Status de Alarmes :</span>
            <div className="flex items-center gap-3">
              <span
                className={clsx(
                  "text-md font-medium uppercase",
                  isInMaintenance ? "text-gray-500" : "text-green-400",
                )}
              >
                {loading || isSaving
                  ? "Enviando..."
                  : isInMaintenance
                    ? " Em Manutenção"
                    : " Monitorando"}
              </span>
              {canResolveAlerts && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={isInMaintenance}
                  aria-label="Alternar manutenção geral"
                  onClick={handleToggleManutencao}
                  disabled={loading || isSaving}
                  className={clsx(
                    "relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer rounded-full transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    isInMaintenance
                      ? "bg-gray-600 hover:bg-gray-700"
                      : "bg-green-600 hover:bg-green-700",
                  )}
                  title={
                    loading || isSaving
                      ? "…"
                      : isInMaintenance
                        ? "Clique se deseja voltar a monitorar"
                        : "Clique se deseja entrar em modo de manutenção"
                  }
                  aria-describedby="tip-switch"
                >
                  <span
                    aria-hidden="true"
                    className={clsx(
                      "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition",
                      isInMaintenance ? "translate-x-0" : "translate-x-6",
                    )}
                  />

                  <span
                    id="tip-switch"
                    role="tooltip"
                    aria-hidden="true"
                    className={clsx(
                      "pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2",
                      "whitespace-nowrap rounded px-2 py-1 text-xs bg-black text-white",
                      "opacity-0 transition",
                      "group-hover:opacity-100 group-focus-visible:opacity-100",
                    )}
                  >
                    {loading || isSaving
                      ? "…"
                      : isInMaintenance
                        ? "Clique se deseja voltar a monitorar"
                        : "Clique se deseja entrar em modo de manutenção"}
                  </span>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleSolicitarStatus}
              disabled={loading || isSaving}
              className="px-3 bg-green-600 hover:bg-green-700 rounded text-sm py-1 disabled:opacity-60"
            >
              {loading ? "..." : "Solicitar Status"}
            </button>

            {canResolveAlerts && (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-sm text-gray-300">Sirene:</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isSireneActive}
                  aria-label="Alternar sirene"
                  onClick={handleToggleSirene}
                  disabled={loading || isSaving}
                  className={clsx(
                    "relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer rounded-full transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    isSireneActive
                      ? "bg-yellow-600 hover:bg-yellow-700"
                      : "bg-gray-600 hover:bg-gray-700",
                  )}
                  title={
                    isSaving
                      ? "Atualizando..."
                      : isSireneActive
                        ? "Sirene ATIVA - Clique para desativar"
                        : "Sirene INATIVA - Clique para ativar"
                  }
                >
                  <span
                    className={clsx(
                      "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition",
                      isSireneActive ? "translate-x-6" : "translate-x-0",
                    )}
                  />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 ml-4 border-l border-gray-600 pl-4 flex-nowrap text-nowrap">
              <span className="text-sm text-gray-300">WhatsApp/SMS:</span>
              <button
                type="button"
                role="switch"
                aria-checked={msgEnabled}
                aria-label="Alternar notificações WhatsApp/SMS"
                onClick={() => updateConfig({ msg: !msgEnabled })}
                disabled={notificationLoading}
                className={clsx(
                  "relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer rounded-full transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  msgEnabled
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-gray-600 hover:bg-gray-700",
                )}
                title={
                  notificationLoading
                    ? "Atualizando..."
                    : msgEnabled
                      ? callEnabled
                        ? "Mensagem + ligação ATIVADAS - Clique para desativar tudo"
                        : "Mensagens ATIVADAS - Clique para desativar"
                      : "Notificações DESATIVADAS - Clique para ativar"
                }
              >
                <span
                  aria-hidden="true"
                  className={clsx(
                    "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition",
                    msgEnabled ? "translate-x-6" : "translate-x-0",
                  )}
                />
              </button>
              <span
                className={clsx(
                  "text-xs font-medium uppercase",
                  msgEnabled ? "text-green-400" : "text-gray-500",
                )}
              >
                {notificationLoading ? "..." : msgEnabled ? "Ativo" : "Inativo"}
              </span>
            </div>

            <div className="flex items-center gap-2 ml-4 border-l border-gray-600 pl-4">
              <span className="text-sm text-gray-300">Ligação WhatsApp</span>
              <button
                type="button"
                role="switch"
                aria-checked={callEnabled}
                aria-label="Alternar notificações WhatsApp/SMS"
                onClick={() =>
                  updateConfig(
                    callEnabled ? { call: false } : { msg: true, call: true },
                  )
                }
                disabled={notificationLoading}
                className={clsx(
                  "relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer rounded-full transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-400",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  callEnabled
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-gray-600 hover:bg-gray-700",
                )}
                title={
                  notificationLoading
                    ? "Atualizando..."
                    : callEnabled
                      ? "Ligação ATIVADA - Clique para voltar a mensagem apenas"
                      : "Ativa ligação junto com a mensagem"
                }
              >
                <span
                  aria-hidden="true"
                  className={clsx(
                    "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition",
                    callEnabled ? "translate-x-6" : "translate-x-0",
                  )}
                />
              </button>
              <span
                className={clsx(
                  "text-xs font-medium uppercase",
                  callEnabled ? "text-green-400" : "text-gray-500",
                )}
              >
                {notificationLoading
                  ? "..."
                  : callEnabled
                    ? "Ativo"
                    : "Inativo"}
              </span>
            </div>
          </div>
        </summary>

        {responseMsg && <div className="mt-2 text-sm">{responseMsg}</div>}

        {(statusSwAt || tensaoAt) && (
          <div className="mb-4 text-sm text-gray-300 flex flex-wrap gap-x-6 gap-y-1">
            {statusSwAt && (
              <span>
                <span className="text-gray-400">Status SW:</span>{" "}
                {statusSwAt}
              </span>
            )}
            {tensaoAt && (
              <span>
                <span className="text-gray-400">Tensão:</span> {tensaoAt}
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {overviewCards.map((c) => {
            const monitorCode = getMonitorCode(c.title) || getMonitorCodeFromId(c.id);
            const panelCard = isPanelCard(c);
            if (
              allowedMonitorCodes.size > 0 &&
              !panelCard &&
              (!monitorCode || !allowedMonitorCodes.has(monitorCode))
            ) {
              return null;
            }
            return (
              <StatusCard
                key={c.title}
                {...c}
                isInMaintenance={isInMaintenance}
                canToggleAlarm={canToggleAlarm}
                monitorCode={monitorCode}
                loading={loading}
                onAlarmOn={() =>
                  sendCommand(
                    `AlarmeON${monitorCode}`,
                    "Alarme ligado com sucesso!",
                    "Falha ao ligar alarme.",
                    pivoId,
                    setResponseMsg,
                    setLoading,
                    loading,
                  )
                }
                onAlarmOff={() =>
                  sendCommand(
                    `AlarmeOFF${monitorCode}`,
                    "Alarme desligado com sucesso!",
                    "Falha ao desligar alarme.",
                    pivoId,
                    setResponseMsg,
                    setLoading,
                    loading,
                  )
                }
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
