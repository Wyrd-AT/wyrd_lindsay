import React, { useEffect, useState, useRef } from "react";
import { IoClose } from "react-icons/io5";
import { FiShare2 } from "react-icons/fi";
import dbStore from "../stores/dbStore";

// Mapeamento para display
const irrigadorIdMap = {
  "111111": "1",
  "222222": "2",
  "333333": "3",
};

const formatAlertId = (alertId) => {
  const [rawId, index] = alertId.split("-");
  const mapped = irrigadorIdMap[rawId] || rawId;
  return `#${mapped}-${index}`;
};

function getBrasiliaTimestamp() {
  const dt = new Date();

  // Converte para horário de Brasília
  const brTime = new Date(
    dt.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );

  // Ajusta o offset de -03:00
  const offsetMs = brTime.getTimezoneOffset() * 60000;
  const localISO = new Date(brTime.getTime() - offsetMs).toISOString();

  // Insere manualmente o fuso -03:00
  return localISO.replace("Z", "-03:00");
}

function getStatusBadge(status) {
  switch (status) {
    case "Não resolvido":
      return (
        <span className="bg-transparent text-[#E83838] border border-[#E83838] px-2 py-1 rounded-full text-xs">
          Não resolvido
        </span>
      );
    case "Em progresso":
      return (
        <span className="bg-transparent text-[#C7A20D] border border-[#C7A20D] px-2 py-1 rounded-full text-xs">
          Em progresso
        </span>
      );
    case "Resolvido":
      return (
        <span className="bg-transparent text-[#42AE10] border border-[#42AE10] px-2 py-1 rounded-full text-xs">
          Resolvido
        </span>
      );
    default:
      return null;
  }
}

export default function AlertEdit({ isOpen, onClose, alertData }) {
  const [loading, setLoading] = useState(false);
  const [responseMsg, setResponseMsg] = useState("");
  const loadingRef = useRef(false);


  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!isOpen || !alertData) return null;

  const {
    id,            // ex: "111111-0"
    machine,       // ex: "IRRIGADOR 1"
    date,
    time,
    status,
    description,
    notifications = {},
    history = [],
  } = alertData;

  const rawId = id.split("-")[0]; // ex: "111111"

  const handleSirene = async () => {
    if (loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setResponseMsg("");

    try {
      const topic = `lindsay/comandos/${rawId}`;
      console.log(rawId)
      const payload = `${rawId};ack`;
      const doc = {
        topic,
        payload,
        origin: "app",
        type: "command",
        qos: 0,
        timestamp: getBrasiliaTimestamp()
      };
      console.log("[AlertEdit] Enviando comando:", doc);
      await dbStore.postData(doc);
      setResponseMsg("✅ Comando enviado com sucesso!");
    } catch (err) {
      console.error("[AlertEdit] Erro ao enviar comando:", err);
      setResponseMsg("❌ Falha ao enviar comando.");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black opacity-50" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-[#2f2f2f] text-white p-6 rounded-md w-full max-w-md flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 text-2xl text-white hover:text-gray-300"
          onClick={onClose}
          aria-label="Fechar"
        >
          <IoClose />
        </button>

        {/* HEADER */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="uppercase text-xs text-gray-400 mb-1">ALERTA</p>
            <h3 className="text-lg font-semibold flex flex-col gap-1">
              <span>{formatAlertId(id)}</span>
              <span className="text-sm text-gray-300">{machine}</span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs bg-gray-800 rounded">{date}</span>
            <span className="px-2 py-1 text-xs bg-gray-800 rounded">{time}</span>
            <span className="px-3 py-1">{getStatusBadge(status)}</span>
          </div>
        </div>

        {/* DESCRIÇÃO */}
        <label className="text-sm text-gray-300 mb-1">Descrição:</label>
        <textarea
          className="w-full bg-[#3a3a3a] text-white p-2 rounded mb-4 text-sm resize-none h-20"
          value={description}
          readOnly
        />

        {/* AÇÕES */}
        <div className="flex flex-wrap gap-2 mb-4">
          {/* <button className="bg-green-500 text-white text-xs font-medium px-3 py-1 rounded-full">
            Ligar Alarme
          </button>
          <button className="bg-yellow-500 text-white text-xs font-medium px-3 py-1 rounded-full">
            Desligar Alarme
          </button> */}
          <button
            className="bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-3 py-1 rounded-full"
            onClick={handleSirene}
            disabled={loading}
          >
            {loading ? "Enviando..." : "Desativar Sirene"}
          </button>
        </div>

        {responseMsg && (
          <p
            className={`mb-4 text-sm ${
              responseMsg.startsWith("✅") ? "text-green-400" : "text-red-400"
            }`}
          >
            {responseMsg}
          </p>
        )}

        {/* NOTIFICAÇÕES */}
        <div className="flex items-center gap-4 mb-4 text-sm">
          <span>Notificações</span>
          {["WhatsApp"].map((chan) => (
            <label key={chan} className="flex items-center gap-1">
              <input
                type="checkbox"
                className="form-checkbox"
                checked={!!notifications[chan]}
                readOnly
              />
              <span>{chan}</span>
            </label>
          ))}
        </div>

        {/* REATIVAR ALARME */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <label>Ativar alarme novamente em:</label>
          <select className="bg-[#3a3a3a] border-b border-gray-600 px-2 py-1 rounded text-xs">
            <option value="15">15 MINUTOS</option>
            <option value="30">30 MINUTOS</option>
            <option value="60">1 HORA</option>
            <option value="120">2 HORAS</option>
            <option value="1440">1 DIA</option>
          </select>
        </div>

        {/* HISTÓRICO */}
        <div className="flex-1 overflow-y-auto mb-4 px-2 py-1 bg-[#3a3a3a] rounded text-xs">
          {history.length === 0 ? (
            <p className="text-gray-400">Sem histórico.</p>
          ) : (
            history.map((evt, i) => (
              <div key={i} className="flex items-start gap-2 mb-1">
                <span className="w-1 bg-gray-500 h-full mt-1" />
                <div>
                  <p className="text-gray-300">
                    {evt.date} às {evt.time}
                  </p>
                  <p>{evt.text}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-1 text-sm px-3 py-1 rounded border border-gray-500 hover:bg-gray-700">
            <FiShare2 />
            <span>exportar</span>
          </button>
          <button className="bg-green-500 hover:bg-green-600 text-white text-sm px-5 py-2 rounded-full">
            SALVAR
          </button>
        </div>
      </div>
    </div>
  );
}
