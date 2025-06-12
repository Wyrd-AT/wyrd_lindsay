import React, { useState, useMemo, useRef, useEffect } from "react";
import { FiAlertOctagon, FiChevronDown, FiChevronUp, FiClock } from "react-icons/fi";
import AlertEdit from "./alertEdit.jsx";
import { useParsedMessages } from "../hooks/useParsedMessages";

// Gera badge de status
function getStatusBadge(status) {
  switch (status) {
    case "Não resolvido":
      return (
        <span className="bg-[#FFE0E5] text-[#E83838] border border-[#E83838] px-2 py-1 rounded text-xs">
          Não resolvido
        </span>
      );
    case "Em progresso":
      return (
        <span className="bg-[#FAFAFA] text-[#C7A20D] border border-[#C7A20D] px-2 py-1 rounded text-xs">
          Em progresso
        </span>
      );
    case "Resolvido":
      return (
        <span className="bg-[#C1E1B2] text-[#42AE10] border border-[#42AE10] px-2 py-1 rounded text-xs">
          Resolvido
        </span>
      );
    default:
      return null;
  }
}

export default function AlertHistory({ machineId }) {
  const [isOpen, setIsOpen] = useState(true);
  const parsed = useParsedMessages();
  const idClean = machineId.replace("IRRIGADOR ", "");

  // Toggle do <details>
  const handleToggle = (e) => setIsOpen(e.target.open);

  // Pré-filtra events e logs do PouchDB
  const alertsFromDB = useMemo(
    () =>
      parsed.filter(
        (msg) => msg.type === "event" && msg.irrigadorId === idClean
      ),
    [parsed, idClean]
  );

  const logsFromDB = useMemo(
    () => parsed.filter((msg) => msg.type === "log"),
    [parsed]
  );

  // Simula status aleatório
  const STATUSES = ["Não resolvido", "Em progresso", "Resolvido"];
  const statusMapRef = useRef({});
  useEffect(() => {
    statusMapRef.current = {};
  }, [idClean]);

  // Monta a lista de alertas para a tabela
  const realAlerts = useMemo(() => {
    return alertsFromDB.map((msg, i) => {
      const key = `${msg.irrigadorId}-${i}`;
      if (!statusMapRef.current[key]) {
        statusMapRef.current[key] =
          STATUSES[Math.floor(Math.random() * STATUSES.length)];
      }
      const dt = new Date(msg.timestamp);
      return {
        id: key,
        _id: msg._id,
        date: dt.toLocaleDateString(),
        time: dt.toLocaleTimeString(),
        eventType: msg.eventType,
        eventCode: msg.eventCode,
        description: msg.description,
        status: statusMapRef.current[key],
        responsible: msg.responsible,
      };
    });
  }, [alertsFromDB]);

  const hasUnresolved = realAlerts.some((a) => a.status === "Não resolvido");

  const [selectedStatus, setSelectedStatus] = useState("Todos");
  const filteredAlerts = useMemo(
    () =>
      realAlerts.filter((a) =>
        selectedStatus === "Todos" ? true : a.status === selectedStatus
      ),
    [realAlerts, selectedStatus]
  );

  // Modal de edição
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);

  const handleRowClick = (alert) => {
  // 1) monta o history filtrando logs
  const history = logsFromDB
    .filter((l) => l.alert_id === alert._id)
    .map((l) => ({
      timestamp: l.timestamp,
      action:    l.action,
      responsible: l.responsible,
    }));

  // 2) encontra o próprio evento já atualizado no parsed
  const eventDoc = parsed.find(
    (msg) => msg.type === "event" && msg._id === alert._id
  );
  const snoozeUntil = eventDoc?.snooze_until
    ? new Date(eventDoc.snooze_until)
    : null;

  // 3) passa tudo para o filho de uma vez
  setEditingAlert({
    ...alert,
    history,
    snooze_until: snoozeUntil,
    notifications: eventDoc?.notifications ?? {},
  });
  setIsEditOpen(true);
};

  const handleCloseEdit = () => {
    setIsEditOpen(false);
    setEditingAlert(null);
  };

  return (
    <details
      className="bg-[#222] text-white p-2 rounded-md w-full mt-4"
      onToggle={handleToggle}
      open={isOpen}
    >
      <summary
        className={`flex items-center justify-between cursor-pointer font-semibold text-lg select-none mb-2 ${
          hasUnresolved ? "pb-1 text-red-600" : ""
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div>Histórico de Alertas</div>
        <div className="flex items-center space-x-3">
          {realAlerts.some((a) => a.status === "Em progresso") && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500 text-white">
              <FiClock className="mr-1" size={14} />
              {realAlerts.filter((a) => a.status === "Em progresso").length}
            </span>
          )}
          {realAlerts.some((a) => a.status === "Não resolvido") && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white">
              <FiAlertOctagon className="mr-1" size={14} />
              {realAlerts.filter((a) => a.status === "Não resolvido").length}
            </span>
          )}
          {isOpen ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
        </div>
      </summary>

      {/* Filtros de status */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {["Todos", ...STATUSES].map((st) => (
          <button
            key={st}
            onClick={() => setSelectedStatus(st)}
            className={`px-3 py-1 rounded-lg ${
              selectedStatus === st
                ? "bg-white text-[#444444]"
                : "bg-[#616061]"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Tabela de alertas */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-[#444444] text-sm uppercase">
            <tr>
              <th className="px-4 py-2">DATA</th>
              <th className="px-4 py-2">HORA</th>
              <th className="px-4 py-2">CÓDIGO</th>
              <th className="px-4 py-2">RESPONSÁVEL</th>
              <th className="px-4 py-2">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {filteredAlerts.map((alert) => (
              <tr
                key={alert.id}
                onClick={() => handleRowClick(alert)}
                className="border-b border-gray-600 last:border-b-0 hover:bg-[#3a3a3a] cursor-pointer"
              >
                <td className="px-4 py-3">{alert.date}</td>
                <td className="px-4 py-3">{alert.time}</td>
                <td className="px-4 py-3">
                  {`${alert.eventType} - ${alert.eventCode}`}
                </td>
                <td className="px-4 py-3">
                  {alert.responsible && alert.responsible !== "None"
                    ? alert.responsible
                    : "---------"}
                </td>
                <td className="px-1 py-3">{getStatusBadge(alert.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de edição */}
      <AlertEdit
        isOpen={isEditOpen}
        onClose={handleCloseEdit}
        onSave={(updated) => setEditingAlert(updated)}
        alertData={editingAlert}
      />
    </details>
  );
}
