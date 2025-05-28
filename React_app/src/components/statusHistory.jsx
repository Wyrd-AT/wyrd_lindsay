import React, { useState, useMemo } from "react";
import { FiSettings } from "react-icons/fi";
import { useParsedMessages } from "../hooks/useParsedMessages";

function StatusCard({ mt, status }) {
  const colorClass =
    status.includes("OK")
      ? "text-green-400"
      : status.includes("Rec")
      ? "text-yellow-400"
      : status.includes("Alarmado")
      ? "text-red-400"
      : "text-gray-500";

  return (
    <div className="w-24 h-16 flex flex-col items-center justify-center bg-[#2b2b2b] p-1 rounded shadow m-1">
      <span className="text-xs font-medium">MT {mt}</span>
      <span className={`mt-1 text-xs font-semibold whitespace-nowrap ${colorClass}`}>
        {status}
      </span>
    </div>
  );
}

export default function StatusHistory({ selectedMachine }) {
  const machineId = selectedMachine.replace("IRRIGADOR ", "");
  const parsed = useParsedMessages();

  const statuses = useMemo(() => {
    return parsed
      .filter((m) => m.type === "monitorStatus" && m.irrigadorId === machineId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [parsed, machineId]);

  const last = statuses[0] || null;

  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = (e) => {
    setIsOpen(e.target.open);
  };

  // Filtra MTs de 1 a 14
  const filteredStatus = last
    ? last.status.filter(({ mt }) => mt >= 1 && mt <= 14)
    : [];

  return (
    <details
      className="bg-[#222] text-white p-2 rounded-md w-full mt-4"
      onToggle={handleToggle}
      open={isOpen}
    >
      <summary
        className="flex items-center cursor-pointer font-semibold text-lg select-none mb-2"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="mr-2">{isOpen ? "▲" : "▼"}</span>
        <FiSettings className="mr-2" />
        Histórico de Status
      </summary>

      {last ? (
        <>
          <p className="text-gray-300 mb-2 text-sm">
            Último status: {new Date(last.timestamp).toLocaleString()}
          </p>
          <div className="grid grid-cols-7 gap-1 justify-center">
            {filteredStatus.map(({ mt, status }) => (
              <StatusCard key={mt} mt={mt} status={status} />
            ))}
          </div>
        </>
      ) : (
        <p className="text-gray-400 text-sm">Nenhum status recebido ainda.</p>
      )}
    </details>
  );
}
