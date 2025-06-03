import React, { useState, useMemo } from "react";
import { FiSettings, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { useParsedMessages } from "../hooks/useParsedMessages";

// Componente de card de status
function StatusCard({ mt, status }) {
  const colorClass =
    status.includes("OK")
      ? "text-green-400"
      : status.includes("Rec")
      ? "text-yellow-400"
      : status.includes("Alarmado")
      ? "text-red-400"
      : "text-gray-500";

  const borderStyle = status.includes("Alarmado")
    ? { border: "2px solid #f87171" }
    : { border: "2px solid transparent" };

  return (
    <div
      style={borderStyle}
      className="h-16 flex flex-col items-center justify-center bg-[#2b2b2b] p-1 rounded shadow"
    >
      <span className="text-xs font-medium">Vão {mt}</span>
      <span className={`mt-1 text-xs font-semibold whitespace-nowrap ${colorClass}`}>
        {status}
      </span>
    </div>
  );
}

export default function StatusHistory({ selectedMachine }) {
  const [isOpen, setIsOpen] = useState(true);
  const [filter, setFilter] = useState("Todos");
  const [sortBy, setSortBy] = useState("urgencia");

  const machineId = selectedMachine.replace("IRRIGADOR ", "");
  const parsed = useParsedMessages();

  const statuses = useMemo(() => {
    return parsed
      .filter((m) => m.type === "monitorStatus" && m.irrigadorId === machineId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [parsed, machineId]);

  const last = statuses[0] || null;
  const filteredStatus = last
    ? last.status.filter(({ mt }) => mt >= 1 && mt <= 14)
    : [];

  const hasAlarm = filteredStatus.some(({ status }) => status.includes("Alarmado"));
  const alarmCount = filteredStatus.filter(({ status }) => status.includes("Alarmado")).length;
  const recCount = filteredStatus.filter(({ status }) => status.includes("Rec")).length;

  const filteredAndSorted = useMemo(() => {
    let arr = filteredStatus;

    if (filter === "Alarmado") {
      arr = arr.filter(({ status }) => status.includes("Alarmado"));
    } else if (filter === "Reconhecido") {
      arr = arr.filter(({ status }) => status.includes("Rec"));
    } else if (filter === "OK") {
      arr = arr.filter(({ status }) => status.includes("OK"));
    }

    if (sortBy === "mtAsc") {
      arr = [...arr].sort((a, b) => a.mt - b.mt);
    } else if (sortBy === "urgencia") {
      const prioridade = (status) => {
        if (status.includes("Alarmado")) return 0;
        if (status.includes("Rec")) return 1;
        if (status.includes("OK")) return 2;
        return 3;
      };
      arr = [...arr].sort((a, b) => prioridade(a.status) - prioridade(b.status));
    }

    return arr;
  }, [filteredStatus, filter, sortBy]);

  const handleToggle = (e) => {
    setIsOpen(e.target.open);
  };

  return (
    <details
      className="bg-[#222] text-white p-2 rounded-md w-full mt-4"
      onToggle={handleToggle}
      open={isOpen}
    >
      <summary
        className={`flex items-center justify-between cursor-pointer font-semibold text-lg select-none mb-2 ${
          hasAlarm ? "pb-1 text-red-600" : ""
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center">
          Status de Alarmes
        </div>

        <div className="flex items-center space-x-3">
          {recCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500 text-white">
              <FiSettings className="mr-1" size={14} />
              {recCount}
            </span>
          )}

          {alarmCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white">
              <FiSettings className="mr-1" size={14} />
              {alarmCount}
            </span>
          )}

          {isOpen ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
        </div>
      </summary>

      {/* Linha fora do summary, com flex, tudo em uma linha sem espaçamento extra label/div */}
      <div className="flex flex-wrap items-center gap-8 mb-4">
        <div className="flex items-center gap-2">
          <label className="font-semibold text-sm">Filtrar:</label>
          {["Todos", "Alarmado", "Reconhecido", "OK"].map((f) => (
            <button
              key={f}
              className={`px-3 py-1 rounded-lg text-sm font-medium ${
                filter === f
                  ? "bg-white text-[#444444]"
                  : "bg-[#616061] text-gray-300 hover:bg-gray-700"
              }`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label className="font-semibold text-sm">Ordenar:</label>
          {[
            { id: "mtAsc", label: "Vãos" },
            { id: "urgencia", label: "Urgência" },
          ].map(({ id, label }) => (
            <button
              key={id}
              className={`px-3 py-1 rounded-lg text-sm font-medium ${
                sortBy === id
                  ? "bg-white text-[#444444]"
                  : "bg-[#616061] text-gray-300 hover:bg-gray-700"
              }`}
              onClick={() => setSortBy(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {last && (
          <span className="ml-auto text-gray-300 text-xs whitespace-nowrap">
            Último status: {new Date(last.timestamp).toLocaleString()}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1">
        {filteredAndSorted.map(({ mt, status }) => (
          <StatusCard key={mt} mt={mt} status={status} />
        ))}
      </div>
    </details>
  );
}
