import React from "react";
import { useParsedMessages } from "../hooks/useParsedMessages";

export default function StatusAlarmInline({ selectedMachine }) {
  const machineId = selectedMachine.replace("IRRIGADOR ", "");
  const parsed = useParsedMessages();

  // filtra e ordena as mensagens monitorStatus
  const statuses = parsed
    .filter((m) => m.type === "monitorStatus" && m.irrigadorId === machineId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const last = statuses[0] || null;

  return (
    <details
      className="text-white bg-[#222] p-4 rounded shadow mt-2"
      open
    >
      <summary className="cursor-pointer font-semibold mb-4">
        Histórico de Status – Último recebido em:{" "}
        {last ? new Date(last.timestamp).toLocaleString() : "N/A"}
      </summary>

      {last ? (
        <div className="grid grid-cols-3 gap-4 w-full justify-items-center">
          {last.status.map(({ mt, status }) => {
            const colorClass = status.includes("OK")
              ? "text-green-400"
              : status.includes("Rec")
              ? "text-yellow-400"
              : status.includes("Alarmado")
              ? "text-red-400"
              : "text-gray-500";
            return (
              <div
                key={mt}
                className="w-36 h-24 flex flex-col items-center justify-center bg-[#2b2b2b] p-2 rounded shadow"
              >
                <span className="text-sm font-medium">MT {mt}</span>
                <span className={`mt-1 text-sm font-semibold whitespace-nowrap ${colorClass}`}>
                  {status}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-gray-400">Nenhum status recebido ainda.</p>
      )}
    </details>
  );
}
