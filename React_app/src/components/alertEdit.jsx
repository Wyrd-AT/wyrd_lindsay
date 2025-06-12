import React, { useEffect, useState, useMemo } from "react";
import { IoClose } from "react-icons/io5";
import { FiShare2 } from "react-icons/fi";

// Formata timestamps em string legível
function formatTimestamp(ts) {
  const d = new Date(ts);
  return d.toLocaleString();
}

const NOTIFICATION_CHANNELS = ["SMS", "WhatsApp", "E-mail", "Ligação"];
const ACTIONS = [
  { label: "Ligar Alarme", style: "bg-green-500 hover:bg-green-600", action: "toggle_alarm" },
  { label: "Desligar Alarme", style: "bg-yellow-500 hover:bg-yellow-600", action: "toggle_alarm" },
  { label: "Ativar Sirene", style: "bg-red-500 hover:bg-red-600", action: "activate_siren" },
];

function getStatusBadge(status) {
  switch (status) {
    case "Não resolvido":
      return <span className="bg-transparent text-[#E83838] border border-[#E83838] px-2 py-1 rounded-full text-xs">Não resolvido</span>;
    case "Em progresso":
      return <span className="bg-transparent text-[#C7A20D] border border-[#C7A20D] px-2 py-1 rounded-full text-xs">Em progresso</span>;
    case "Resolvido":
      return <span className="bg-transparent text-[#42AE10] border border-[#42AE10] px-2 py-1 rounded-full text-xs">Resolvido</span>;
    default:
      return null;
  }
}

export default function AlertEdit({ isOpen, onClose, alertData }) {
  const [description, setDescription]     = useState("");
  const [responsible, setResponsible]     = useState("");
  const [notifications, setNotifications] = useState({});
  const [snoozeTime, setSnoozeTime]       = useState("");  // "" = sem lembrete
  const [history, setHistory]             = useState([]);

  // 1) Fecha modal ao pressionar ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Inicializa campos ao trocar alertData
  useEffect(() => {
    if (!alertData) return;
    setDescription(alertData.description || "");
    setResponsible(alertData.responsible || "");
    setNotifications(alertData.notifications || {});
    setHistory(alertData.history || []);
    setSnoozeTime(alertData.snooze_time != null ? String(alertData.snooze_time) : "");
  }, [alertData]);

  // Memoiza histórico formatado
  const formattedHistory = useMemo(() =>
    history.map((entry, idx) => ({
      key: idx,
      timestamp: formatTimestamp(entry.timestamp),
      action: entry.action,
      responsible: entry.responsible || "Responsável não definido"
    })), [history]
  );

  // Salva descrição/responsável e fecha modal
  const updateDescription = async () => {
    if (!alertData) return;
    try {
      const resp = await fetch(`http://localhost:8000/alerts/${alertData._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: alertData.status,
          description,
          responsible,
        }),
      });
      if (!resp.ok) throw new Error("Falha ao atualizar");
      alert("Descrição atualizada com sucesso!");
      onClose();  // 2) Fecha ao salvar
    } catch (err) {
      alert("Erro: " + err.message);
    }
  };

  // Dispara ações (toggle_alarm, activate_siren)
  const handleAction = async (action) => {
    if (!alertData) return;
    try {
      const resp = await fetch(`http://localhost:8000/alerts/${alertData._id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await resp.json();
      if (resp.ok && data.message) alert(data.message);
      else throw new Error(data.detail || "Sem confirmação");
    } catch (err) {
      alert("Erro ao executar a ação: " + err.message);
    }
  };

  // Altera canais de notificação
  const handleNotificationChange = (chan) =>
    setNotifications(n => ({ ...n, [chan]: !n[chan] }));

  // 3) Ajusta lembrete via novo endpoint e registra no histórico
  const handleSnoozeChange = async (value) => {
    if (!alertData) return;
    setSnoozeTime(value);
    try {
      const resp = await fetch(
        `http://localhost:8000/alerts/snooze/${alertData._id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snooze: value === "" ? null : Number(value) }),
        }
      );
      const data = await resp.json();
      if (resp.ok && data.message) alert(data.message);
      else throw new Error(data.detail || "Erro ao ajustar lembrete");
    } catch (err) {
      alert("Erro: " + err.message);
    }
  };

  if (!isOpen || !alertData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black opacity-50" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-[#2f2f2f] text-white p-6 rounded-md w-full max-w-md flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Fechar */}
        <button
          className="absolute top-4 right-4 text-2xl hover:text-gray-300"
          onClick={onClose}
          aria-label="Fechar"
        >
          <IoClose />
        </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="uppercase text-xs text-gray-400 mb-1">ALERTA</p>
            <h3 className="text-lg font-semibold">#{alertData.id}</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs bg-gray-800 rounded">{alertData.date}</span>
            <span className="px-2 py-1 text-xs bg-gray-800 rounded">{alertData.time}</span>
            <span className="px-3 py-1">{getStatusBadge(alertData.status)}</span>
          </div>
        </div>

        {/* Descrição */}
        <label className="text-sm text-gray-300 mb-1">Descrição:</label>
        <textarea
          className="w-full bg-[#3a3a3a] text-white p-2 rounded mb-4 text-sm resize-none h-16"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />

        {/* Responsável */}
        <label className="text-sm text-gray-300 mb-1">Responsável:</label>
        <input
          type="text"
          className="w-full bg-[#3a3a3a] text-white p-2 rounded mb-4 text-sm"
          value={responsible}
          onChange={e => setResponsible(e.target.value)}
        />

        {/* Ações */}
        <div className="flex flex-wrap gap-2 mb-4">
          {ACTIONS.map(act => (
            <button
              key={act.label}
              onClick={() => handleAction(act.action)}
              className={`${act.style} text-white text-xs font-medium px-3 py-1 rounded-full`}
            >
              {act.label}
            </button>
          ))}
        </div>

        {/* Notificações */}
        <div className="flex items-center gap-4 mb-4 text-sm">
          <span>Notificações</span>
          {NOTIFICATION_CHANNELS.map(chan => (
            <label key={chan} className="flex items-center gap-1">
              <input
                type="checkbox"
                className="form-checkbox"
                checked={notifications[chan] || false}
                onChange={() => handleNotificationChange(chan)}
              />
              <span>{chan}</span>
            </label>
          ))}
        </div>

        {/* lembrete */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <label>Definir lembrete em:</label>
          <select
            className="bg-[#3a3a3a] border-b border-gray-600 px-2 py-1 rounded text-xs"
            value={snoozeTime}
            onChange={e => handleSnoozeChange(e.target.value)}
          >
            <option value="">Sem lembrete</option>
            <option value="15">15 MINUTOS</option>
            <option value="30">30 MINUTOS</option>
            <option value="60">1 HORA</option>
            <option value="120">2 HORAS</option>
            <option value="1440">1 DIA</option>
          </select>
        </div>

        {/* Histórico */}
        <div className="flex-1 overflow-y-auto mb-4 px-2 py-1 bg-[#3a3a3a] rounded text-xs">
          {formattedHistory.length === 0 ? (
            <p className="text-gray-400">Sem histórico.</p>
          ) : (
            formattedHistory.map(entry => (
              <div key={entry.key} className="flex items-start gap-2 mb-1">
                <span className="w-1 bg-gray-500 h-full mt-1" />
                <div>
                  <p className="text-gray-300">
                    <span className="font-bold">{entry.timestamp} - </span>
                    <strong>{entry.action}</strong> –{" "}
                    <em>{entry.responsible}</em>
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-1 text-sm px-3 py-1 rounded border border-gray-500 hover:bg-gray-700">
            <FiShare2 />
            <span>exportar</span>
          </button>
          <button
            onClick={updateDescription}
            className="bg-green-500 hover:bg-green-600 text-white text-sm px-5 py-2 rounded-full"
          >
            SALVAR
          </button>
        </div>
      </div>
    </div>
  );
}
