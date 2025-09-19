// src/components/StatusHistory.jsx
import React, { useState, useRef, useMemo } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import clsx from "clsx";
import useMessageStore from "../stores/messageStore";
import SyncProvider from "./SyncProvider";
import StatusAlarmModal from "./statusAlarmModal";
import { useDataStoreManutecoes, useManutecoes } from "../stores/dataStoreTimers1";
import { parseSwVector, STATUS_MAP } from "../hooks/vetorSW";

// Mapeamento dos códigos para a descrição
const valueDescriptions = STATUS_MAP;

// ★ delay configurável entre MAN e SW (em ms)
const SW_UPDATE_DELAY_MS = 10000;

// utilzinho para aguardar
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function StatusCard({ title, statuses, onClick, isInMaintenance }) {
  const allOK = statuses.some((s) => s.value === "0");
  const hasAlarmado = statuses.some((s) => s.value === "1");
  const hasReconhecido = statuses.some((s) => s.value === "2");
  const hasAlarmeOff = statuses.some((s) => s.value === "3");
  const hasAusente = statuses.some((s) => s.value === "9");



  const statusLabel = isInMaintenance ? "Em manutenção" : hasAlarmado
    ? "Alarmado"
    : hasReconhecido
      ? "Reconhecido"
      : allOK
        ? "Normal"
        : hasAlarmeOff ? "Alarme OFF" : hasAusente ? "Ausente" : "Desconhecido";

  const classes = clsx(
    "h-full flex flex-col items-center justify-center rounded border-2 p-2 transition-colors duration-200 cursor-pointer",
    {
      "animate-blink-bg border-red-500 text-white": hasAlarmado,
      "bg-red-500 border-transparent text-white": !hasAlarmado && hasReconhecido,
      "bg-[#08cb7c] border-[#08cb7c] text-white": allOK && !hasAlarmado,
      "bg-[#444444] border-transparent text-white":
        !allOK && !hasAlarmado && !hasReconhecido || isInMaintenance,
    }
  );

  return (
    <div className={classes} onClick={onClick}>
      <span className="font-semibold">{title}</span>
      <span className="mt-1 text-sm">{statusLabel}</span>
      <div className="mt-2 flex flex-col items-start gap-1 text-xs">
        {statuses.map((s) => {
          const isTensionField =
            s.label === "Falha por tensão" || s.label === "Tensão (V)";
          const desc = isTensionField
            ? s.value
            : valueDescriptions[s.value] || s.value;
          return (
            <div key={s.label} className="flex items-center">
              <span className="font-medium px-1">{s.label}:</span>
              <span>{desc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function StatusHistory({
  selectedMachine,
  vetoressw = [],
  equipamentos = [],
  vectorsTensions = [],
}) {
  const [isOpen, setIsOpen] = useState(true);
  const loadingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [responseMsg, setResponseMsg] = useState("");
  const [activeCard, setActiveCard] = useState(null);

  // ★ override local do modo manutenção para refletir no UI imediatamente
  const [localManOverride, setLocalManOverride] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // 1) Filtra só a máquina selecionada (SW)
  const filteredByMachine = useMemo(() => {
    if (!selectedMachine) return [];
    return vetoressw.filter((entry) => entry.split(";")[0] === selectedMachine);
  }, [vetoressw, selectedMachine]);

  // 2) Encontra a entrada SW mais recente
  const latestEntry = useMemo(() => {
    if (!filteredByMachine.length) return null;
    return filteredByMachine.reduce((prev, curr) => {
      const toTime = (str) =>
        new Date(str.split(";")[1].replace(" ", "T")).getTime();
      return toTime(curr) > toTime(prev) ? curr : prev;
    });
  }, [filteredByMachine]);

  // 3) Converte essa entrada em Date
  const lastSwDate = useMemo(() => {
    if (!latestEntry) return null;
    return new Date(latestEntry.split(";")[1].replace(" ", "T"));
  }, [latestEntry]);

  // ★ parse seguro do vetor SW
  const parsed_sw = useMemo(
    () => (latestEntry ? parseSwVector(latestEntry) : null),
    [latestEntry]
  );

  // 1b) Filtra só a máquina selecionada (Tensões)
  const filteredTensions = useMemo(() => {
    if (!selectedMachine) return [];
    return vectorsTensions.filter(
      (entry) => entry.split(";")[0] === selectedMachine
    );
  }, [vectorsTensions, selectedMachine]);

  // 2b) Encontra a entrada de tensões mais recente
  const latestTensionEntry = useMemo(() => {
    if (!filteredTensions.length) return null;
    return filteredTensions.reduce((prev, curr) => {
      const toTime = (str) =>
        new Date(str.split(";")[1].replace(" ", "T")).getTime();
      return toTime(curr) > toTime(prev) ? curr : prev;
    });
  }, [filteredTensions]);

  // 3b) Extrai só os valores de tensão (pulando ID e timestamp)
  const tensionValues = useMemo(() => {
    if (!latestTensionEntry) return [];
    return latestTensionEntry.split(";").slice(2);
  }, [latestTensionEntry]);

  // 3c)
  const shiftedTensions = useMemo(() => tensionValues.slice(0), [tensionValues]);

  // ★ estado efetivo de manutenção (remoto → parsed_sw, com override local)
  const isInMaintenance = useMemo(() => {
    if (localManOverride !== null) return localManOverride;
    return parsed_sw?.status_manutencao === "1";
  }, [localManOverride, parsed_sw]);

  // 4) Monta os cards de status
  const cards = useMemo(() => {
    if (!parsed_sw || !filteredByMachine.length || equipamentos.length < 3) return [];

    const baseCards = [
      {
        title: equipamentos[0],
        statuses: [{ label: "status", value: parsed_sw.painel_1 }],
      },
      {
        title: equipamentos[1],
        statuses: [{ label: "status", value: parsed_sw.painel_1 }],
      },
    ];

    const dynamicCards = equipamentos
      .slice(2)
      .map((name, i) => {
        if (name === "Ausente") return null;

        const monitores = parsed_sw.monitores?.[i] || "";
        if (!monitores) return null;

        const panelTension = shiftedTensions[i];
        return {
          title: name,
          statuses: [
            { label: "SW1", value: monitores.statusSw1 },
            { label: "SW2", value: monitores.statusSw2 },
            { label: "Falha por tensão", value: monitores.armadilha },
            { label: "Tensão SW", value: monitores.statusTensao },
            ...(panelTension != null
              ? [{ label: "Tensão (V)", value: parseFloat(panelTension).toFixed(2) }]
              : []),
          ],
        };
      })
      .filter(Boolean);

    return [...baseCards, ...dynamicCards].filter((card) => card.title !== "Ausente");
  }, [filteredByMachine, equipamentos, shiftedTensions, parsed_sw]);

  // Timestamp em Brasília
  function getBrasiliaTimestamp() {
    const dtf = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = dtf.formatToParts(new Date());
    const year = parts.find((p) => p.type === "year").value;
    const month = parts.find((p) => p.type === "month").value;
    const day = parts.find((p) => p.type === "day").value;
    const hour = parts.find((p) => p.type === "hour").value;
    const minute = parts.find((p) => p.type === "minute").value;
    const second = parts.find((p) => p.type === "second").value;
    return `${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`;
  }

  // Função genérica para enviar comandos
  const sendCommand = async (command, successText, failureText) => {
    if (!selectedMachine) {
      setResponseMsg("❌ Nenhuma máquina selecionada.");
      return;
    }
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setResponseMsg("");

    try {
      const payload = `${selectedMachine};${command}`;
      const doc = {
        topic: `lindsay/comandos/${selectedMachine}`,
        payload,
        origin: "app",
        table: "command",
        qos: 0,
        timestamp: getBrasiliaTimestamp(),
      };
      await useMessageStore.getState().postMessage(doc);
      setResponseMsg(`✅ ${successText}`);
    } catch (err) {
      console.error("[StatusHistory] erro ao enviar comando:", err);
      setResponseMsg(`❌ ${failureText}`);
      throw err; // ★ propaga erro para quem chamou
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  // Handlers específicos
  const handleSolicitarStatus = async (e) => {
    e.stopPropagation();
    await sendCommand("sw", "Status solicitado com sucesso!", "Falha ao solicitar status.");
  };

  const handleSirene = async (e) => {
    e.stopPropagation();
    await sendCommand("sirene", "Sirene disparada com sucesso!", "Falha ao disparar sirene.");
  };

  const handleEnviar = async (e) => {
    e.stopPropagation();
    await sendCommand("ack", "Comando ACK enviado com sucesso!", "Falha ao enviar comando ACK.");
  };

  /** TOGGLE de manutenção (Desativar/Reativar Geral) */
  const handleToggleManutencao = async (e) => {
    e.stopPropagation();
    if (!selectedMachine) {
      setResponseMsg("❌ Nenhuma máquina selecionada.");
      return;
    }

    // ★ reflete imediatamente no UI
    const current = isInMaintenance;
    const next = !current;
    setLocalManOverride(next);

    setIsSaving(true);
    try {
      // 1) Envia MAN
      await sendCommand(
        "man",
        "Manutenção alternada com sucesso!",
        "Falha ao alternar manutenção."
      );

      // 2) Aguarda um tempo
      await sleep(SW_UPDATE_DELAY_MS);

      // 3) Pede atualização SW
      await sendCommand(
        "sw",
        "Atualização solicitada com sucesso!",
        "Falha ao atualizar."
      );
    } catch (err) {
      // ★ reverte o override local em caso de erro
      setLocalManOverride(current);
      console.error("Erro ao alternar manutenção:", err);
      setResponseMsg("❌ Erro ao alternar modo de manutenção.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <details
        className="bg-[#222] text-white p-4 rounded-md w-full mt-4"
        open={isOpen}
        onToggle={(e) => setIsOpen(e.target.open)}
      >
        <summary
          className="flex items-center justify-between cursor-pointer font-semibold text-lg mb-2 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <span className="uppercase">Status de Alarmes</span>
            {/* BOTÃO TOGGLE: Desativar/Reativar Geral */}
            <div className="flex items-center gap-3">
              {/* SWITCH */}
              <span className="group relative select-none uppercase">
                {loading || isSaving
                  ? "Enviando..."
                  : isInMaintenance
                    ? ": Em Manutenção"
                    : ": Monitorando"}


              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isInMaintenance}
                aria-label="Alternar manutenção geral"
                onClick={handleToggleManutencao}
                disabled={loading || isSaving}
                // ⬇️ adicionei "group"
                className={clsx(
                  "group relative inline-flex h-6 w-12 flex-shrink-0 cursor-pointer rounded-full transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-400",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  isInMaintenance ? "bg-red-600 hover:bg-red-700" : "bg-gray-600 hover:bg-gray-700"
                )}
                // fallback nativo (opcional)
                title={
                  loading || isSaving
                    ? "…"
                    : isInMaintenance
                      ? "Clique se deseja voltar a monitorar"
                      : "Clique se deseja entrar em modo de manutenção"
                }
                // liga o botão ao tooltip para leitores de tela
                aria-describedby="tip-switch"
              >
                <span
                  aria-hidden="true"
                  className={clsx(
                    "pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition",
                    isInMaintenance ? "translate-x-7" : "translate-x-1"
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
                    // ⬇️ mostra no hover e no foco via teclado
                    "group-hover:opacity-100 group-focus-visible:opacity-100"
                  )}
                >
                  {loading || isSaving
                    ? "…"
                    : isInMaintenance
                      ? "Clique se deseja voltar a monitorar"
                      : "Clique se deseja entrar em modo de manutenção"}
                </span>
              </button>


              {/* RÓTULO DINÂMICO */}

            </div>
            <button
              type="button"
              onClick={handleSolicitarStatus}
              disabled={loading || isSaving}
              className="px-3 bg-green-600 hover:bg-green-700 rounded text-sm py-1 disabled:opacity-60"
            >
              {loading ? "..." : "Solicitar Status"}
            </button>
            <button
              type="button"
              onClick={handleSirene}
              disabled={loading || isSaving}
              className="px-3 bg-yellow-600 hover:bg-yellow-700 rounded text-sm py-1 disabled:opacity-60"
            >
              {loading ? "..." : "Disparar Sirene"}
            </button>
            


          </div>
          {isOpen ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
        </summary>

        {responseMsg && <div className="mt-2 text-sm">{responseMsg}</div>}

        {lastSwDate && (
          <div className="mb-4 text-sm text-gray-300">
            Última atualização carregada em:{" "}
            {lastSwDate.toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {cards.map((c) => (
            <StatusCard key={c.title} {...c} onClick={() => setActiveCard(c)} isInMaintenance={isInMaintenance} />
          ))}
        </div>
      </details>

      <StatusAlarmModal
        isOpen={!!activeCard}
        onClose={() => setActiveCard(null)}
        selectedMachine={selectedMachine}
        card={activeCard}
      />
    </>
  );
}
