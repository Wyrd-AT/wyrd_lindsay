// components/StatusAlarmModal.jsx
import React, { useEffect, useState } from "react";
import { IoClose } from "react-icons/io5";
import dbStore from "../stores/dbStore";
import { useParsedMessages } from "../hooks/useParsedMessages";

export default function StatusAlarmModal({ isOpen, onClose, selectedMachine }) {
  const machineId = selectedMachine.replace("IRRIGADOR ", "");
  const parsed = useParsedMessages();

  // filtra e ordena as mensagens monitorStatus
  const statuses = parsed
    .filter(m => m.type === "monitorStatus" && m.irrigadorId === machineId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const last = statuses[0] || null;

  const [loading, setLoading] = useState(false);
  const [responseMsg, setResponseMsg] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  // fecha modal com Esc
  useEffect(() => {
    const handleEsc = e => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  // envia o alarme
  const handleSendAlarm = async () => {
    setLoading(true);
    setResponseMsg("");
    try {
      const payload = `${machineId};alarme`;
      const doc = {
        topic: `lindsay/comandos`,
        payload,
        origin: "app",
        qos: 0,
        timestamp: new Date().toISOString(),
      };
      await dbStore.postData(doc);
      setResponseMsg("✅ Alarme enviado com sucesso!");
      setShowDetails(false);
    } catch {
      setResponseMsg("❌ Falha ao enviar alarme.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black opacity-60" />

      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 bg-[#222] p-6 rounded-lg w-[520px] max-h-[80vh] overflow-auto text-white flex flex-col items-center"
        onClick={e => e.stopPropagation()}
      >
        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white text-2xl hover:text-gray-400"
          aria-label="Fechar"
        >
          <IoClose />
        </button>

        {/* Título */}
        <h2 className="text-2xl font-semibold mb-4 text-center">
          Status Alarme – {selectedMachine}
        </h2>

        {/* Botão enviar alarme */}
        <button
          onClick={handleSendAlarm}
          disabled={loading}
          className="bg-red-600 px-6 py-2 rounded mb-4 hover:bg-red-700 disabled:opacity-50"
        >
          {loading ? "Solicitando..." : "Solicitar Status"}
        </button>

        {/* Mensagem de resposta */}
        {responseMsg && (
          <p className={`mb-4 ${responseMsg.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>
            {responseMsg}
          </p>
        )}

        {/* Timestamp e toggle de detalhes */}
        {last ? (
          <>
            <p className="text-gray-300 mb-2 text-center">
              Último status: {new Date(last.timestamp).toLocaleString()}
            </p>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className={`px-4 py-1 mb-4 rounded ${
                showDetails ? "bg-gray-600 hover:bg-gray-500" : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {showDetails ? "Ocultar Detalhes" : "Mostrar Detalhes"}
            </button>
          </>
        ) : (
          <p className="text-gray-400 mb-4">Nenhum status recebido ainda.</p>
        )}

        {/* Grid de detalhes com 18 MTs em 3 colunas */}
        {showDetails && last && (
          <div className="grid grid-cols-3 gap-4 w-full justify-items-center">
            {last.status.map(({ mt, status }) => (
              <div
                key={mt}
                className="w-36 h-24 flex flex-col items-center justify-center bg-[#2b2b2b] p-2 rounded shadow"
              >
                <span className="text-sm font-medium">MT {mt}</span>
                <span
                  className={`mt-1 text-sm font-semibold whitespace-nowrap ${
                    status.includes("OK") || status.includes("Resolvido")
                      ? "text-green-400"
                      : status.includes("Alarmado") || status.includes("Erro")
                      ? "text-red-400"
                      : "text-yellow-400"
                  }`}
                >
                  {status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
