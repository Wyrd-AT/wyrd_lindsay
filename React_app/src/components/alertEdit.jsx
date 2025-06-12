import React, { useEffect, useState, useMemo, useRef } from "react";
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

function Toast({ type = "info", children, onClose }) {
  const bg = {
    info:    "bg-blue-600",
    success: "bg-green-600",
    error:   "bg-red-600"
  }[type] || "bg-gray-600";

  return (
    <div
      className={`${bg} bg-opacity-75 text-white px-6 py-3 rounded shadow-lg flex items-center pointer-events-auto`}
    >
      <span className="flex-1">{children}</span>
      <button onClick={onClose} className="ml-2 font-bold text-xl leading-none">
        ×
      </button>
    </div>
  );
}

function Spinner(props) {
  return (
    <svg viewBox="0 0 50 50" fill="none" stroke="currentColor"
         strokeWidth="5" strokeLinecap="round"
         strokeDasharray="31.4 31.4" {...props}>
      <circle cx="25" cy="25" r="20" />
    </svg>
  );
}

export default function AlertEdit({ isOpen, onClose, onSave, alertData }) {
  const [description, setDescription]     = useState("");
  const [responsible, setResponsible]     = useState("");
  const [notifications, setNotifications] = useState({});
  const [snoozeSelect, setSnoozeSelect]   = useState("");
  const [snoozeUntil, setSnoozeUntil]     = useState(null);
  const [history, setHistory]             = useState([]);

  // estados de UI
  const [loading, setLoading]             = useState(false);
  const [notification, setNotification]   = useState(null);

  const initial = useRef({});

  // Fecha modal com ESC
  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  // Sincroniza estado interno sempre que alertData mudar
  useEffect(() => {
    if (!alertData) return;
    setDescription(alertData.description || "");
    setResponsible(alertData.responsible || "");
    setNotifications(alertData.notifications || {});
    setSnoozeSelect("");
    setSnoozeUntil(
      alertData.snooze_until ? new Date(alertData.snooze_until) : null
    );
    setHistory(alertData.history || []);
    initial.current = {
      description: alertData.description || "",
      responsible: alertData.responsible || "",
      notifications: { ...alertData.notifications },
      snoozeSelect: ""
    };
  }, [alertData]);

  // Inverte e formata histórico
  const formattedHistory = useMemo(() => {
    return [...history]
      .reverse()
      .map((entry, idx) => ({
        key: idx,
        timestamp: formatTimestamp(entry.timestamp),
        action: entry.action,
        responsible: entry.responsible || "Responsável não definido"
      }));
  }, [history]);

  const handleNotificationChange = (chan) =>
    setNotifications(prev => ({ ...prev, [chan]: !prev[chan] }));
  const handleSnoozeChange = (val) => setSnoozeSelect(val);

  // Salva alterações
  const handleSave = async () => {
    if (!alertData) return;
    setLoading(true);
    setNotification(null);

    const payload = {
      status:       alertData.status,
      description,
      responsible,
      notifications,
      snooze_time:  snoozeSelect === "" ? null : Number(snoozeSelect),
    };

    try {
      const res = await fetch(
        `http://localhost:8000/alerts/update/${alertData._id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      if (!res.ok) {
        const { detail } = await res.json();
        throw new Error(detail || "Falha ao salvar");
      }

      // atualiza localmente antes de fechar
      const newSnoozeUntil = payload.snooze_time != null
        ? new Date(Date.now() + payload.snooze_time * 60000)
        : null;
      const newLog = {
        timestamp:  new Date().toISOString(),
        action:     payload.snooze_time == null
                      ? "lembrete removido"
                      : `lembrete para ${payload.snooze_time} min`,
        responsible: responsible || ""
      };
      const updatedAlert = {
        ...alertData,
        description,
        responsible,
        notifications,
        snooze_until: newSnoozeUntil,
        history:      [...history, newLog]
      };

      onSave && onSave(updatedAlert);
    // 1) mostra a notificação
    setNotification({ type: "success", message: "Alterações salvas com sucesso!" });
    // 2) aguarda 2s (ou o tempo que você quiser)
    setTimeout(() => {
      // apaga a notificação
      setNotification(null);
      // e aí fecha o modal
      onClose();
    }, 2000);
    window.location.reload(true);
    } catch (e) {
      setNotification({ type: "error", message: e.message });
    } finally {
      setLoading(false);
    }
  };

  // Ações rápidas
  const handleAction = async (action) => {
    if (!alertData) return;
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:8000/alerts/${action}/${alertData._id}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Erro na ação");
      setNotification({ type: "success", message: data.message });
    } catch (e) {
      setNotification({ type: "error", message: e.message });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !alertData) return null;

return (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4"
    onClick={onClose}
  >
    {/* Fundo escuro */}
    <div className="absolute inset-0 bg-black opacity-50" />

    {/* Container do modal (relative para o aviso ficar relativo a ele) */}
    <div
      role="dialog"
      aria-modal="true"
      className="relative bg-[#2f2f2f] text-white p-6 rounded-md w-full max-w-md flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Aviso centralizado dentro do modal */}
      {notification && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 pointer-events-none">
          <div
            className={`px-4 py-2 rounded shadow-lg text-white ${
              notification.type === "success"
                ? "bg-green-600"
                : "bg-red-600"
            }`}
          >
            {notification.message}
          </div>
        </div>
      )}

      {/* Botão de fechar */}
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
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* Responsável */}
        <label className="text-sm text-gray-300 mb-1">Responsável:</label>
        <input
          type="text"
          className="w-full bg-[#3a3a3a] text-white p-2 rounded mb-4 text-sm"
          value={responsible}
          onChange={(e) => setResponsible(e.target.value)}
        />

        {/* Ações imediatas */}
        <div className="flex flex-wrap gap-2 mb-4">
          {ACTIONS.map((act) => (
            <button
              key={act.label}
              disabled={loading}
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
          {NOTIFICATION_CHANNELS.map((chan) => (
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

        {/* Lembrete */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <label>Lembrete:</label>
          <select
            className="bg-[#3a3a3a] border-b border-gray-600 px-2 py-1 rounded text-xs"
            value={snoozeSelect}
            onChange={(e) => handleSnoozeChange(e.target.value)}
            disabled={loading}
          >
            <option value="">Sem lembrete</option>
            <option value="15">15 MINUTOS</option>
            <option value="30">30 MINUTOS</option>
            <option value="60">1 HORA</option>
            <option value="120">2 HORAS</option>
            <option value="1440">1 DIA</option>
          </select>
          {snoozeUntil && (
            <span className="ml-auto text-xs text-gray-300">
              Lembrete para: {formatTimestamp(snoozeUntil)}
            </span>
          )}
        </div>

        {/* Histórico */}
        <div className="flex-1 overflow-y-auto mb-4 px-2 py-1 bg-[#3a3a3a] rounded text-[0.65rem] max-h-20">
          {formattedHistory.length === 0 ? (
            <p className="text-gray-400">Sem histórico.</p>
          ) : (
            formattedHistory.map((entry) => (
              <div key={entry.key} className="flex items-start gap-2 mb-1">
                <span className="w-1 bg-gray-500 h-full mt-1" />
                <div>
                  <p className="text-gray-300">
                    <span className="font-bold">{entry.timestamp} – </span>
                    <strong>{entry.action}</strong> – <em>{entry.responsible}</em>
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-1 text-sm px-3 py-1 rounded border border-gray-500 hover:bg-gray-700" disabled={loading}>
            <FiShare2 />
            <span>exportar</span>
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="relative bg-green-500 hover:bg-green-600 text-white text-sm px-5 py-2 rounded-full flex items-center justify-center"
          >
            {loading && <Spinner className="w-4 h-4 mr-2 animate-spin" />}
            SALVAR
          </button>
        </div>
      </div>
    </div>
  );
}
