import React, { useState, useMemo } from "react";
import { FiSettings, FiChevronDown, FiChevronUp } from "react-icons/fi";
import { useParsedMessages } from "../hooks/useParsedMessages";

// Componente de card de status
function StatusCard({ mt, status }) {
  const isOK = status.includes("OK");
  const isResolved = status.includes("Resolvido");
  const isAlarm = status.includes("Alarmado");
  const isRec = status.includes("Rec");

  // Texto que aparece no card
  const displayStatus = isRec
    ? "Alarme reconhecido"
    : status;

  // Cor do texto
  const colorClass = (isOK || isResolved)
    ? "text-green-400"
    : (isAlarm || isRec)
    ? "text-red-400"
    : "text-gray-500";

  // Borda somente em alarmes ativos
  const borderStyle = isAlarm
    ? { border: "2px solid #f87171" }
    : { border: "2px solid transparent" };

  return (
    <div
      style={borderStyle}
      className="h-16 flex flex-col items-center justify-center bg-[#2b2b2b] p-1 rounded shadow"
    >
      <span className="text-xs font-medium">Vão {mt}</span>
      <span className={`mt-1 text-xs font-semibold whitespace-nowrap ${colorClass}`}>
        {displayStatus}
      </span>
    </div>
  );
}

export default function StatusHistory({ selectedMachine }) {
  const [isOpen, setIsOpen] = useState(true);
  const machineId = selectedMachine.replace("IRRIGADOR ", "");
  const parsed = useParsedMessages();

  const statuses = useMemo(() => {
    return parsed
      .filter((m) => m.type === "monitorStatus" && m.irrigadorId === machineId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [parsed, machineId]);

  const last = statuses[0] || null;
  const statusesToShow = last
    ? last.status
        .filter(({ status }) => status && status.trim() !== "")
        .slice(0, 14)
    : [];

  const alarmCount = statusesToShow.filter(({ status }) => status.includes("Alarmado")).length;
  const recCount = statusesToShow.filter(({ status }) => status.includes("Rec")).length;

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
          alarmCount > 0 ? "pb-1 text-red-600" : ""
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center">Status de Alarmes</div>
        <div className="flex items-center space-x-3">
          {/* Reconhecidos em vermelho */}
          {recCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white">
              <FiSettings className="mr-1" size={14} />
              {recCount}
            </span>
          )}
          {/* Alarmados em vermelho */}
          {alarmCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white">
              <FiSettings className="mr-1" size={14} />
              {alarmCount}
            </span>
          )}
          {/* Último timestamp */}
          {last && (
            <span className="text-xs text-gray-300 whitespace-nowrap">
              Último: {new Date(last.timestamp).toLocaleString()}
            </span>
          )}
          {isOpen ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
        </div>
      </summary>
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1">
        {statusesToShow.map(({ mt, status }) => (
          <StatusCard key={mt} mt={mt} status={status} />
        ))}
      </div>
    </details>
  );
}
