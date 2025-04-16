// components/MensagemModal.jsx
import React, { useEffect, useState } from "react";
import { IoClose } from "react-icons/io5";
import dbStore from "../stores/dbStore";
import { useParsedMessages } from "../hooks/useParsedMessages";

export default function MensagemModal({ isOpen, onClose, selectedMachine }) {
  const [comando, setComando] = useState("");
  const [loading, setLoading] = useState(false);
  const [responseMsg, setResponseMsg] = useState("");
  // Hook já deve incluir docs de type "command"
  const parsedMessages = useParsedMessages();

  // Fecha com Esc
  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  const stopProp = (e) => e.stopPropagation();

  const handleEnviar = async (e) => {
    e.preventDefault();
    console.log("🔄 handleEnviar chamado", { comando, selectedMachine });
    setLoading(true);
    setResponseMsg("");

    const doc = {
      type: "command",
      irrigadorId: selectedMachine.replace("IRRIGADOR ", ""),
      command: comando,
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await dbStore.postData(doc);
      console.log("📥 postData retornou", res);
      setResponseMsg("✅ Comando enviado com sucesso!");
    } catch (err) {
      console.error("❌ postData falhou", err);
      setResponseMsg("❌ Falha ao enviar comando.");
    } finally {
      setLoading(false);
      setComando("");
    }
  };

  // Filtra histórico de comandos só para esta máquina
  const history = parsedMessages
    .filter((m) => m.type === "command" &&
      m.irrigadorId === selectedMachine.replace("IRRIGADOR ", ""))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black opacity-60" />

      <div
        className="relative z-10 bg-[#222] p-6 rounded-lg w-[70vw] max-h-[80vh] overflow-auto text-white"
        role="dialog"
        aria-modal="true"
        onClick={stopProp}
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
        <h2 className="text-2xl font-semibold mb-4">
          Enviar Comando para {selectedMachine}
        </h2>

        {/* Formulário de envio */}
        <form onSubmit={handleEnviar} className="flex gap-2 items-center mb-4">
          <input
            type="text"
            value={comando}
            onChange={(e) => setComando(e.target.value)}
            placeholder="Ex: alarme, reset..."
            required
            className="flex-1 px-2 py-1 text-black rounded"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 px-4 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Enviar"}
          </button>
        </form>

        {/* Feedback */}
        {responseMsg && (
          <p className={`mb-4 ${responseMsg.startsWith("✅") ? "text-green-400" : "text-red-400"}`}>
            {responseMsg}
          </p>
        )}

        {/* Histórico de Comandos */}
        <div>
          <h3 className="text-xl font-semibold mb-2">Histórico de Mensagens</h3>
          {history.length > 0 ? (
            <ul className="space-y-2">
              {history.map((msg, idx) => (
                <li
                  key={idx}
                  className="bg-[#1f2b36] p-3 rounded flex justify-between items-center"
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
