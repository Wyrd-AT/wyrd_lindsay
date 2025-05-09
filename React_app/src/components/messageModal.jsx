// components/MensagemModal.jsx
import React, { useEffect, useState, useRef } from "react";
import { IoClose } from "react-icons/io5";
import dbStore from "../stores/dbStore";
import { useParsedMessages } from "../hooks/useParsedMessages";

export default function MensagemModal({ isOpen, onClose, selectedMachine }) {
  const [comando, setComando] = useState("");
  const [loading, setLoading] = useState(false);
  const [responseMsg, setResponseMsg] = useState("");
  const [inputError, setInputError] = useState("");
  const loadingRef = useRef(false);
  const parsed = useParsedMessages();

  // Fecha com Esc
  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  const machineId = selectedMachine.replace("IRRIGADOR ", "");
  const history = parsed
    .filter((m) => m.type === "command" && m.irrigadorId === machineId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const handleEnviar = async (e) => {
    e.preventDefault();

    // Bloqueia envios duplicados enquanto estiver carregando
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setResponseMsg("");
    setInputError("");

    // Bloqueia comandos de alarme aqui
    if (comando.toLowerCase().includes("alarme")) {
      setInputError("Para enviar alarmes, utilize o botão Status Alarme.");
      setLoading(false);
      loadingRef.current = false;
      return;
    }

    try {
      const payload = `${machineId};${comando}`;
      const doc = {
        topic: `lindsay/comandos`,
        payload,
        origin: "app",
        qos: 0,
        timestamp: new Date().toISOString(),
      };
      console.log("[MensagemModal] enviando doc:", doc);
      await dbStore.postData(doc);
      setResponseMsg("✅ Comando enviado com sucesso!");
      setComando("");
    } catch (err) {
      console.error("[MensagemModal] erro ao enviar comando:", err);
      setResponseMsg("❌ Falha ao enviar comando.");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black opacity-60" />
      <div
        className="relative z-10 bg-[#222] p-6 rounded-lg w-[500px] max-h-[80vh] overflow-auto text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white text-2xl hover:text-gray-400"
          aria-label="Fechar"
        >
          <IoClose />
        </button>

        <h2 className="text-2xl font-semibold mb-4">
          Enviar Comando – {selectedMachine}
        </h2>

        <form onSubmit={handleEnviar} className="flex flex-col gap-2 mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={comando}
              onChange={(e) => setComando(e.target.value)}
              placeholder="Ex: reset, ligar..."
              required
              disabled={loading}
              className="flex-1 px-3 py-2 rounded text-black focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-green-600 px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
            >
              {loading ? "Enviando..." : "Enviar"}
            </button>
          </div>
          {inputError && <p className="text-red-400 text-sm">{inputError}</p>}
        </form>

        {responseMsg && (
          <p
            className={`mb-4 ${
              responseMsg.startsWith("✅") ? "text-green-400" : "text-red-400"
            }`}
          >
            {responseMsg}
          </p>
        )}

        <div className="overflow-y-auto max-h-60">
          <h3 className="text-lg font-semibold mb-2">Histórico de Comandos</h3>
          {history.length ? (
            <ul className="space-y-2">
              {history.map((msg, idx) => (
                <li
                  key={idx}
                  className="flex justify-between bg-[#2b2b2b] p-3 rounded"
                >
                  <span className="text-gray-300 text-sm">
                    {new Date(msg.timestamp).toLocaleString()}
                  </span>
                  <span className="text-white">{msg.command}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">Nenhuma mensagem enviada ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}
