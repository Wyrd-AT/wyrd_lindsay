// components/MessageHistory.jsx
import React from "react";
import { useParsedMessages } from "../hooks/useParsedMessages";

export default function MessageHistory({ machineId }) {
  const msgs = useParsedMessages().filter(
    (m) => m.type === "command" && m.irrigadorId === machineId.replace("IRRIGADOR ", "")
  );

  if (!msgs.length) {
    return <p className="text-gray-300">Nenhuma mensagem enviada.</p>;
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-2">Histórico de Mensagens</h3>
      <ul className="space-y-1">
        {msgs.map((m, i) => (
          <li key={i} className="px-4 py-2 bg-[#1f2b36] rounded">
            <span className="text-sm text-gray-400">
              {new Date(m.timestamp).toLocaleString()}:
            </span>{" "}
            <span className="text-white">{m.command}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
