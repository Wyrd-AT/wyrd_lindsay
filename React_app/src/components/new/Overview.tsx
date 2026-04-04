// app/(pivo)/[pivoId]/overview.tsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import clsx from "clsx";
import { FiChevronDown, FiChevronUp, FiEdit2 } from "react-icons/fi";
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

// Força o + e limita a 3 números (padrão de DDI internacional)
const formatCountryCode = (value: string) => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length === 0) return "+";
  return `+${numbers.slice(0, 3)}`;
};

// Máscara inteligente: aplica formato BR se for +55, senão deixa livre
const formatLocalPhoneMask = (value: string, isBrazil: boolean) => {
  const numbers = value.replace(/\D/g, "");
  if (numbers.length === 0) return "";

  if (isBrazil) {
    let masked = "";
    if (numbers.length > 0) masked += `(${numbers.slice(0, 2)}`;
    if (numbers.length > 2) masked += `) ${numbers.slice(2, 7)}`;
    if (numbers.length > 7) masked += `-${numbers.slice(7, 11)}`;
    return masked;
  }

  return numbers; // Sem máscara para outros países
};

// Gera a máscara parcial (Ex: +55 (••) •••••-8383)
const maskSavedPhone = (phone: string) => {
  if (!phone || phone.length < 8) return "";

  // Pega o DDI (Assume os 3 primeiros caracteres se não for +55)
  const isBR = phone.startsWith("+55");
  const country = isBR ? "+55" : phone.substring(0, 3);

  // Pega os últimos 4 dígitos reais
  const last4 = phone.slice(-4);

  return `${country} (••) •••••-${last4}`;
};

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

  // FASE 1 - Performance: Adaptive polling
  // Starts at 10s, increases to 20s, then 30s if no changes detected
  const [pollInterval, setPollInterval] = useState(10000); // Aumentado de 5s para 10s
  const [noChangeCount, setNoChangeCount] = useState(0);

  /* ----------------- WhatsApp por irrigador ----------------- */
  // const {
  //   enabled: whatsappEnabled,
  //   loading: whatsappLoading,
  //   toggle: toggleWhatsapp,
  // } = useWhatsappPerIrrigador(pivoId, email);

  /* ----------------- WhatsApp por irrigador ----------------- */
  const {
    msgEnabled,
    callEnabled,
    savedPhone, // <- Novo estado que o hook retorna
    updateConfig, // <- Usaremos o update direto em vez dos toggles avulsos
    loading: notificationLoading,
  } = useWhatsappPerIrrigador(pivoId, email);

  // Estados para o Modal de Telefone (Captura Contextual)
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [countryCode, setCountryCode] = useState("+55");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pendingAction, setPendingAction] = useState<{
    msg?: boolean;
    call?: boolean;
  } | null>(null);

  // Função que intercepta o clique nas chavinhas
  const handleToggleIntercept = (action: { msg?: boolean; call?: boolean }) => {
    // Se a pessoa quer LIGAR alguma notificação E não temos o telefone dela salvo...
    const wantsToEnable = action.msg === true || action.call === true;
    if (wantsToEnable && !savedPhone) {
      setPendingAction(action);
      setIsPhoneModalOpen(true);
    } else {
      // Se ela quer desligar ou já tem telefone, vai direto
      updateConfig(action);
    }
  };

  // Função para abrir o modal no modo de edição (pré-preenchendo os campos)
  const handleEditPhone = () => {
    if (savedPhone) {
      const isBR = savedPhone.startsWith("+55");
      const cCode = isBR ? "+55" : savedPhone.substring(0, 3);
      const num = savedPhone.substring(cCode.length);

      setCountryCode(cCode);
      setPhoneNumber(formatLocalPhoneMask(num, isBR));

      // Como não estamos ligando/desligando nada, a pendingAction fica nula.
      // O handleSavePhone vai apenas atualizar o número no CouchDB.
      setPendingAction(null);
      setIsPhoneModalOpen(true);
    }
  };
  const handleSavePhone = () => {
    const cleanCountry = countryCode.replace(/\D/g, "");
    const cleanNumber = phoneNumber.replace(/\D/g, "");

    if (!cleanCountry || cleanNumber.length < 8) {
      alert("Por favor, insira um código de país e telefone válidos.");
      return;
    }

    // Junta tudo. Ex: +5511999999999
    const finalPhone = `+${cleanCountry}${cleanNumber}`;

    updateConfig({ ...pendingAction, phone: finalPhone });
    setIsPhoneModalOpen(false);
    setPendingAction(null);
  };

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
  // FASE 1 - Performance: Adaptive polling (5s → 15s → 30s)
  useChangesListener({
    db: "lindsay-data",
    onChange: (changes) => {
      // Verifica se alguma mudança é relevante para este pivoId
      const hasRelevantChange = changes.some((change) => {
        // Verifica se o documento pertence a este pivoId
        const docId = change.id;
        return docId.includes(String(pivoId));
      });

      if (hasRelevantChange) {
        //console.log('Detectada mudança relevante no CouchDB, atualizando dados...');
        // Reset polling interval when change detected
        setPollInterval(10000); // Aumentado de 5s para 10s
        setNoChangeCount(0);
        loadData();
      } else {
        // No relevant change: gradually increase polling interval
        setNoChangeCount((prev) => {
          const next = prev + 1;
          if (next === 3) {
            // After 3 polls with no changes, increase to 20s
            setPollInterval(20000); // Aumentado de 15s para 20s
            //console.log('ℹ️ No changes detected, increasing poll interval to 20s');
          } else if (next >= 6) {
            // After 6 polls with no changes, increase to 30s
            setPollInterval(30000);
            //console.log('ℹ️ No changes detected, increasing poll interval to 30s');
          }
          return next;
        });
      }
    },
    includeDocs: false, // Não precisa do doc completo, só do ID para verificar
    pollInterval: pollInterval, // Dynamic polling interval
    useLongpoll: true, // Usa longpoll para reduzir requisições
    pause: !pivoId, // Pausa se não tiver pivoId
    onError: (error) => {
      console.error("Erro no listener de mudanças:", error);
    },
  });

  const parsed_sw = useMemo(() => parseSwVectorOverview(swDoc?.data), [swDoc]);

  const lastUpdate = useMemo(() => {
    // tenta SW.updated_at, depois SW.data.timestamp (ISO ou BR)
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
      // se for ISO, Date.parse funciona; se for BR, usa parseBrToMs
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

    // para monitores além dos 2 painéis, use os nomes extras de equipamentos
    const dynamics: DeviceCard[] = equipamentoNames.slice(2).map((name, i) => {
      const m = parsed_sw.monitores?.[i];
      const tVal = tensionValues[i];

      if (!m) {
        return {
          id: `${name}-${i}`,
          title: name,
          statuses: [{ label: "status", value: "9" }],
        }; // Ausente
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

  /* ----------------- ações & modal (inalterado) ----------------- */
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
            {/* BOTÃO TOGGLE: Desativar/Reativar Geral */}
            <div className="flex items-center gap-3">
              {/* SWITCH */}
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

                  {/* Tooltip */}
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

            {/* Toggle Sirene */}
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

            {/* Toggle WhatsApp para este irrigador */}
            <div className="flex items-center gap-2 ml-4 border-l border-gray-600 pl-4 flex-nowrap text-nowrap">
              <span className="text-sm text-gray-300">WhatsApp/SMS:</span>
              <button
                type="button"
                role="switch"
                aria-checked={msgEnabled}
                aria-label="Alternar notificações WhatsApp/SMS"
                onClick={() => handleToggleIntercept({ msg: !msgEnabled })}
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

            {/* Toggle WhatsApp para este irrigador */}
            <div className="flex items-center gap-2 ml-4 border-l border-gray-600 pl-4">
              <span className="text-sm text-gray-300">Ligação WhatsApp</span>
              <button
                type="button"
                role="switch"
                aria-checked={callEnabled}
                aria-label="Alternar notificações WhatsApp/SMS"
                onClick={() =>
                  handleToggleIntercept(
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

            {/* --- NOVO: Contato Salvo (Máscara Parcial + Editar) --- */}
            {savedPhone && (
              <div className="flex items-center gap-2 ml-4 border-l border-gray-600 pl-4 text-nowrap">
                <span
                  className="text-sm text-gray-300 font-mono tracking-wide"
                  title="Número cadastrado"
                >
                  {maskSavedPhone(savedPhone)}
                </span>
                <button
                  type="button"
                  onClick={handleEditPhone}
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                  title="Editar telefone de notificação"
                >
                  <FiEdit2 size={15} />
                </button>
              </div>
            )}
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

      {/* --- MODAL CAPTURA DE TELEFONE --- */}
      {isPhoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
          <div className="bg-[#313131] border border-gray-600 p-6 rounded-lg w-96 max-w-[90%] text-white shadow-xl">
            <h3 className="text-lg font-semibold mb-2">
              {pendingAction ? "Telefone Necessário" : "Editar Telefone"}
            </h3>
            <p className="text-sm text-gray-300 mb-4">
              {pendingAction
                ? "Para enviarmos alertas deste equipamento, precisamos do seu número de WhatsApp com DDD."
                : "Atualize o seu número de WhatsApp para recebimento de alertas."}
            </p>
            <div className="flex gap-2 mb-4">
              {/* Input DDI (País) */}
              <input
                type="text"
                value={countryCode}
                onChange={(e) =>
                  setCountryCode(formatCountryCode(e.target.value))
                }
                placeholder="+55"
                className="w-1/4 p-2 bg-[#222] border border-gray-600 rounded text-white text-center focus:outline-none focus:ring-2 focus:ring-green-500"
              />

              {/* Input Telefone Local */}
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) =>
                  setPhoneNumber(
                    formatLocalPhoneMask(e.target.value, countryCode === "+55"),
                  )
                }
                maxLength={countryCode === "+55" ? 15 : 16}
                placeholder="(11) 99999-9999"
                className="w-3/4 p-2 bg-[#222] border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsPhoneModalOpen(false);
                  setPendingAction(null);
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePhone}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-semibold transition-colors"
              >
                {pendingAction ? "Salvar e Ativar" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
