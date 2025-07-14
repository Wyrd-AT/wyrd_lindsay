// src/components/StatusHistory.jsx
import React, { useState, useRef, useMemo } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import clsx from "clsx";
import SyncProvider from "./SyncProvider";
import useMessageStore from "../stores/messageStore";
import StatusAlarmModal from "./statusAlarmModal";

// Mapeamento dos códigos para a descrição
const valueDescriptions = {
  "0": "Normal",
  "1": "Alarmado",
  "2": "Reconhecido",
  "3": "Alarme OFF",
  "9": "Ausente",
};

function StatusCard({ title, statuses, onClick }) {
  const allOK = statuses.every((s) => s.value === "0");
  const hasAlarmado = statuses.some((s) => s.value === "1");
  const hasReconhecido = statuses.some((s) => s.value === "2");

  const statusLabel = hasAlarmado
    ? "Alarmado"
    : hasReconhecido
    ? "Reconhecido"
    : allOK
    ? "OK"
    : "Desconhecido";

  const classes = clsx(
    "h-full flex flex-col items-center justify-center rounded border-2 p-2 transition-colors duration-200 cursor-pointer",
    {
      "animate-blink-bg border-red-500 text-white": hasAlarmado,
      "bg-red-500 border-transparent text-white":
        !hasAlarmado && hasReconhecido,
      "bg-[#08cb7c] border-[#08cb7c] text-white": allOK && !hasAlarmado,
      "bg-[#444444] border-transparent text-white":
        !allOK && !hasAlarmado && !hasReconhecido,
    }
  );

  return (
    <div className={classes} onClick={onClick}>
      <span className="font-semibold">{title}</span>
      <span className="mt-1 text-sm">{statusLabel}</span>
      <div className="mt-2 flex flex-col items-start gap-1 text-xs">
        {statuses.map((s) => {
          const isTensionField =
            s.label === "Falha por tensão" || s.label.includes("Tensão (V)");
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

  // 1) Filtra só a máquina selecionada (SW)
  const filteredByMachine = useMemo(() => {
    if (!selectedMachine) return [];
    return vetoressw.filter(
      (entry) => entry.split(";")[0] === selectedMachine
    );
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

  // 4) Monta os cards de status, agora incluindo tensão
  const cards = useMemo(() => {
    if (!filteredByMachine.length || equipamentos.length < 3) return [];

    const header = latestEntry.split(";").slice(2);
    const [rawSw1, rawSw2, torresRaw, ...restoRaw] = header;
    const [torre1, torre2] = torresRaw.split("");
    restoRaw[0] = restoRaw[0] + torre1;
    restoRaw[7] = restoRaw[0] + torre2;

    const baseCards = [
      {
        title: equipamentos[0],
        statuses: [{ label: "status", value: rawSw1 }],
      },
      {
        title: equipamentos[1],
        statuses: [{ label: "status", value: rawSw2 }],
      },
    ];

    const dynamicCards = equipamentos
      .slice(2)
      .map((name, i) => {
        const raw = restoRaw[i] || "";
        if (!raw) return null;

        const panelTension = tensionValues[i];
        if (i === 0 || i === 7) {
          const [s1, s2, arm, ten, rf] = raw.split("");
          return {
            title: name,
            statuses: [
              { label: "SW1", value: s1 },
              { label: "SW2", value: s2 },
              { label: "Falha por tensão", value: arm },
              { label: "Tensão SW", value: ten },
              { label: "RF", value: rf },
              ...(panelTension != null
                ? [{ label: "Tensão (V)", value: panelTension.slice(0, -1) }]
                : []),
            ],
          };
        } else {
          const [s1, s2, arm, ten] = raw.split("");
          return {
            title: name,
            statuses: [
              { label: "SW1", value: s1 },
              { label: "SW2", value: s2 },
              { label: "Falha por tensão", value: arm },
              { label: "Tensão SW", value: ten },
              ...(panelTension != null
                ? [{ label: "Tensão (V)", value: panelTension.slice(0, -1) }]
                : []),
            ],
          };
        }
      })
      .filter(Boolean);

    return [...baseCards, ...dynamicCards];
  }, [filteredByMachine, equipamentos, latestEntry, tensionValues]);

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

  // Envia o comando ACK para desativar a sirene
  const handleEnviar = async (e) => {
    e.preventDefault();
    if (!selectedMachine) {
      setResponseMsg("❌ Nenhuma máquina selecionada.");
      return;
    }
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setResponseMsg("");

    try {
      const payload = `${selectedMachine};ack`;
      const doc = {
        topic: `lindsay/comandos/${selectedMachine}`,
        payload,
        origin: "app",
        table: "command",
        qos: 0,
        timestamp: getBrasiliaTimestamp(),
      };
      await useMessageStore.getState().postMessage(doc);
      setResponseMsg("✅ Comando ACK enviado com sucesso!");
    } catch (err) {
      console.error("[StatusHistory] erro ao enviar comando ack:", err);
      setResponseMsg("❌ Falha ao enviar comando ACK.");
    } finally {
      setLoading(false);
      loadingRef.current = false;
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
          <div className="flex items-center gap-4">
            <span className="uppercase">Status de Alarmes</span>
            <button
              type="button"
              className="px-4 bg-blue-600 hover:bg-blue-700 rounded text-sm py-1"
              onClick={handleEnviar}
              disabled={loading}
            >
              {loading ? "Enviando..." : "Desativar sirene"}
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
            <StatusCard
              key={c.title}
              {...c}
              onClick={() => setActiveCard(c)}
            />
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
