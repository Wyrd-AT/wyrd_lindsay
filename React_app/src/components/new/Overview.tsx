// app/(pivo)/[pivoId]/overview.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import clsx from "clsx";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import {
  getRecentAll,
  RecentSWDoc,
  RecentTensaoDoc,
} from "../../hooks/new/getRecent";
import { StatusCard } from "./statusCard";
import StatusAlarmModal from "./statusAlarmModal";
import {
  DeviceCard,
  Irrigador,
  monitoresToVoltageMap,
  OverviewProps,
  parseBrToMs,
  parseSwVectorOverview,
  sendCommand,
} from "../../helpers/helperOverview";
import { useWhatsappPerIrrigador } from "../../hooks/new/useWhatsappPerIrrigador";
import { useChangesListener } from "../../hooks/new/useChangesListener";
import {
  useAuthStore,
  selectCanResolveAlerts,
} from "../../stores/new/authStore";

export default function Overview({
  pivoId,
  cnpjCliente,
  email,
  equipamentoNames = [],
}: OverviewProps) {
  const [activeCard, setActiveCard] = useState<DeviceCard | null>(null);
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
  const user = useAuthStore((state) => state.user); // [NOVO] Puxando dados do usuário

  // FASE 1 - Performance: Adaptive polling
  const [pollInterval, setPollInterval] = useState(10000);
  const [noChangeCount, setNoChangeCount] = useState(0);

  /* ----------------- WhatsApp por irrigador ----------------- */
  const {
    msgEnabled,
    callEnabled,
    updateConfig, // Atualização direta
    loading: notificationLoading,
  } = useWhatsappPerIrrigador(pivoId, email, user?.phone_number); // [NOVO] Passa o telefone do authStore

  /* ----------------- Carregar snapshots via getRecentAll ----------------- */
  const [swDoc, setSwDoc] = useState<RecentSWDoc | null>(null);
  const [tA, setTA] = useState<RecentTensaoDoc | null>(null);
  const [tB, setTB] = useState<RecentTensaoDoc | null>(null);

  // Função para carregar dados do CouchDB
  const loadData = useCallback(async () => {
    if (!pivoId) return;

    try {
      const all = await getRecentAll("lindsay-data", String(pivoId));
      setSwDoc(all.sw ?? null);
      setTA(all.tensao.A ?? null);
      setTB(all.tensao.B ?? null);
    } catch (e: any) {
      console.error(e?.message ?? "Falha ao carregar snapshots recentes");
    }
  }, [pivoId]);

  // Carrega dados inicialmente
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listener de mudanças do CouchDB para atualização automática
  useChangesListener({
    db: "lindsay-data",
    onChange: (changes) => {
      const hasRelevantChange = changes.some((change) => {
        const docId = change.id;
        return docId.includes(String(pivoId));
      });

      if (hasRelevantChange) {
        setPollInterval(10000);
        setNoChangeCount(0);
        loadData();
      } else {
        setNoChangeCount((prev) => {
          const next = prev + 1;
          if (next === 3) {
            setPollInterval(20000);
          } else if (next >= 6) {
            setPollInterval(30000);
          }
          return next;
        });
      }
    },
    includeDocs: false,
    pollInterval: pollInterval,
    useLongpoll: true,
    pause: !pivoId,
    onError: (error) => {
      console.error("Erro no listener de mudanças:", error);
    },
  });

  const parsed_sw = useMemo(() => parseSwVectorOverview(swDoc?.data), [swDoc]);

  const lastUpdate = useMemo(() => {
    if (swDoc?.updated_at) {
      const d = new Date(swDoc.updated_at);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      }
    }
    const ts = swDoc?.data?.timestamp;
    if (ts) {
      const msISO = Date.parse(ts);
      const ms = Number.isNaN(msISO) ? parseBrToMs(ts) : msISO;
      if (!Number.isNaN(ms)) {
        return new Date(ms).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
      }
    }
    return "—";
  }, [swDoc]);

  /* ----------------- Tensão: média de A e B por monitor ----------------- */
  const voltA = useMemo(() => monitoresToVoltageMap(tA || undefined), [tA]);
  const voltB = useMemo(() => monitoresToVoltageMap(tB || undefined), [tB]);

  const tensionValues = useMemo(() => {
    const N = parsed_sw?.monitores?.length ?? 0;
    const out: (number | null)[] = Array.from({ length: N }, () => null);

    for (let mt = 1; mt <= N; mt++) {
      const a = voltA.get(mt);
      const b = voltB.get(mt);
      const val =
        Number.isFinite(a as number) && Number.isFinite(b as number)
          ? ((a as number) + (b as number)) / 2
          : Number.isFinite(a as number)
            ? (a as number)
            : Number.isFinite(b as number)
              ? (b as number)
              : null;

      if (val == null) continue;
      const idx = mt - 1;
      if (idx >= 0 && idx < N) out[idx] = val;
    }
    return out;
  }, [voltA, voltB, parsed_sw?.monitores?.length]);

  /* ----------------- manutenção & nomes ----------------- */
  const isInMaintenance = useMemo(
    () =>
      localManOverride !== null
        ? localManOverride
        : parsed_sw?.status_manutencao === "1",
    [localManOverride, parsed_sw],
  );

  const isSireneActive = useMemo(
    () =>
      localSireneOverride !== null
        ? localSireneOverride
        : parsed_sw?.sirene === "1",
    [localSireneOverride, parsed_sw],
  );

  useEffect(() => {
    if (parsed_sw) {
      setLocalSireneOverride(null);
    }
  }, [parsed_sw?.sirene]);

  /* ----------------- cards ----------------- */
  const cards: DeviceCard[] = useMemo(() => {
    if (!parsed_sw) return [];

    const base: DeviceCard[] = [
      {
        id: "painel-1",
        title: equipamentoNames[0] ?? "Painel 1",
        statuses: [{ label: "status", value: parsed_sw.painel_1 }],
      },
      {
        id: "painel-2",
        title: equipamentoNames[1] ?? "Painel 2",
        statuses: [
          { label: "status", value: parsed_sw.painel_2 ?? parsed_sw.painel_1 },
        ],
      },
    ];

    const dynamics: DeviceCard[] = equipamentoNames.slice(2).map((name, i) => {
      const m = parsed_sw.monitores?.[i];
      const tVal = tensionValues[i];

      if (!m) {
        return {
          id: `${name}-${i}`,
          title: name,
          statuses: [{ label: "status", value: "9" }],
        };
      }

      return {
        id: `${name}-${i}`,
        title: name,
        statuses: [
          { label: "SW1", value: m.statusSw1 },
          { label: "SW2", value: m.statusSw2 },
          { label: "Falha por tensão", value: m.armadilha },
          { label: "Tensão SW", value: m.statusTensao },
          ...(Number.isFinite(tVal as number)
            ? [{ label: "Tensão (V)", value: (tVal as number).toFixed(2) }]
            : []),
        ],
      };
    });

    return [...base, ...dynamics].filter((card) => card.title !== "Ausente");
  }, [equipamentoNames, parsed_sw, tensionValues]);

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

        {(swDoc || tA || tB) && (
          <div className="mb-4 text-sm text-gray-300 flex flex-wrap gap-x-6 gap-y-1">
            {swDoc && (
              <span>
                <span className="text-gray-400">Status SW:</span> {lastUpdate}
              </span>
            )}
            {(tA || tB) && (
              <span>
                <span className="text-gray-400">Tensão:</span>{" "}
                {new Date((tA ?? tB)!.updated_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {cards.map((c) => (
            <StatusCard
              key={c.title}
              {...c}
              onClick={() => setActiveCard(c)}
              isInMaintenance={isInMaintenance}
            />
          ))}
        </div>
      </div>

      {activeCard && (
        <StatusAlarmModal
          isOpen={!!activeCard}
          onClose={() => setActiveCard(null)}
          selectedMachine={pivoId}
          card={activeCard}
        />
      )}
    </>
  );
}
