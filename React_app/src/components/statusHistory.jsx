// src/components/StatusHistory.jsx
import React, { useState, useMemo } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import clsx from "clsx";
import SyncProvider from "./SyncProvider";

// Mapeamento dos códigos para a descrição
const valueDescriptions = {
  "0": "Normal",
  "1": "Alarmado",
  "2": "Reconhecido",
  "3": "Alarme OFF",
  "9": "Ausente",
};

function StatusCard({ title, statuses }) {
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
    "h-36 flex flex-col items-center justify-center rounded border-2 p-2 transition-colors duration-200",
    {
      "animate-blink-bg border-red-500 text-white": hasAlarmado,
      "bg-red-500 border-transparent text-white": !hasAlarmado && hasReconhecido,
      "bg-green-500 border-green-500 text-white": allOK && !hasAlarmado,
      "bg-[#444444] border-transparent text-white":
        !allOK && !hasAlarmado && !hasReconhecido,
    }
  );

  return (
    <div className={classes}>
      <span className="font-semibold">{title}</span>
      <span className="mt-1 text-sm">{statusLabel}</span>

      <div className="mt-2 flex flex-col items-start gap-1 text-xs">
        {statuses.map((s) => {
          const desc =
            s.label === "Falha por tensão"
              ? s.value
              : valueDescriptions[s.value];
          return (
            <div key={s.label} className="flex text-center items-center">
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
}) {
  const [isOpen, setIsOpen] = useState(true);

  // 1) Filtra só a máquina selecionada
  const filteredByMachine = useMemo(() => {
    if (!selectedMachine) return [];
    return vetoressw.filter(
      (entry) => entry.split(";")[0] === selectedMachine
    );
  }, [vetoressw, selectedMachine]);

  // 2) Encontra a entrada mais recente
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

  // 4) Monta os cards de status
  const cards = useMemo(() => {
    if (!filteredByMachine.length || equipamentos.length < 3) return [];

    const latest = latestEntry;
    const header = latest.split(";").slice(2);
    const [rawSw1, rawSw2, torresRaw, ...restoRaw] = header;
    const [torre1, torre2] = torresRaw.split("");

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

    const TOWER_GROUP_SIZE = 7;
    const dynamicCards = equipamentos
      .slice(3)
      .map((name, i) => {
        const raw = restoRaw[i] || "";
        if (!raw) return null;

        const isAlarmByTower =
          (torre1 === "1" && i < TOWER_GROUP_SIZE) ||
          (torre2 === "1" &&
            i >= TOWER_GROUP_SIZE &&
            i < TOWER_GROUP_SIZE * 2);

        if (isAlarmByTower) {
          return {
            title: name,
            statuses: [
              { label: "SW1", value: "1" },
              { label: "SW2", value: "1" },
              { label: "Falha por tensão", value: "1" },
              { label: "Tensão", value: "1" },
            ],
          };
        }

        const [s1, s2, arm, ten] = raw.split("");
        return {
          title: equipamentos.slice(2)[i],
          statuses: [
            { label: "SW1", value: s1 },
            { label: "SW2", value: s2 },
            { label: "Falha por tensão", value: arm },
            { label: "Tensão", value: ten },
          ],
        };
      })
      .filter(Boolean);

    return [...baseCards, ...dynamicCards];
  }, [filteredByMachine, equipamentos, latestEntry]);

  return (
    <SyncProvider>

      <details
        className="bg-[#222] text-white p-4 rounded-md w-full mt-4"
        open={isOpen}
        onToggle={(e) => setIsOpen(e.target.open)}
      >
        <summary
          className="flex items-center justify-between cursor-pointer font-semibold text-lg mb-2 select-none"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="uppercase">Status de Alarmes</span>
          {isOpen ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
        </summary>

        {/* Exibe a data do último SW carregado */}
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
            <StatusCard key={c.title} {...c} />
          ))}
        </div>
      </details>
    </SyncProvider>
  );
}
