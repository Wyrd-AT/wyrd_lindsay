// src/components/alertHistory.jsx
import React, { useState, useMemo, useRef, useEffect } from "react";
import { FiAlertOctagon } from "react-icons/fi";
import AlertEdit from "./alertEdit.jsx";
import { useParsedMessages } from "../hooks/useParsedMessages";

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
  const parsed = useParsedMessages();

  const alertsFromDB = useMemo(
    () =>
      parsed.filter(
        (msg) =>
          msg.type === "event" &&
          msg.irrigadorId === machineId.replace("IRRIGADOR ", "")
      ),
    [parsed, machineId]
  );

  const STATUSES = ["Não resolvido", "Em progresso", "Resolvido"];
  const statusMapRef = useRef({});

  useEffect(() => {
    statusMapRef.current = {};
  }, [machineId]);

  const realAlerts = useMemo(() => {
    return alertsFromDB.map((msg, i) => {
      const id = `${msg.irrigadorId}-${i}`;
      if (!statusMapRef.current[id]) {
        const rnd = STATUSES[Math.floor(Math.random() * STATUSES.length)];
        statusMapRef.current[id] = rnd;
      }
      const dt = new Date(msg.timestamp);
      return {
        id,
        date: dt.toLocaleDateString(),
        time: dt.toLocaleTimeString(),
        machine: `IRRIGADOR ${msg.irrigadorId}`,
        description: `Tipo: ${msg.eventType} | Código: ${msg.eventCode}`,
        status: statusMapRef.current[id],
      };
    });
  }, [alertsFromDB]);

  const [selectedStatus, setSelectedStatus] = useState("Todos");
  const filteredAlerts = realAlerts.filter((a) =>
    selectedStatus === "Todos" ? true : a.status === selectedStatus
  );

  // Modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);

  const handleRowClick = (alert) => {
    setEditingAlert(alert);
    setIsEditOpen(true);
  };
  const handleCloseEdit = () => {
    setIsEditOpen(false);
    setEditingAlert(null);
  };

  return (
    <div className="bg-[#313131] text-white p-8 rounded-md w-full mt-8">
      <div className="flex items-center pb-4">
        <FiAlertOctagon />
        <h2 className="text-xl font-semibold pl-4">HISTÓRICO DE ALERTAS</h2>
      </div>

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

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-[#444444] text-sm uppercase">
            <tr>
              <th className="px-4 py-2">DATA</th>
              <th className="px-4 py-2">HORA</th>
              <th className="px-4 py-2">MÁQUINA</th>
              <th className="px-4 py-2">DESCRIÇÃO</th>
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
                <td className="px-4 py-3">{alert.machine}</td>
                <td className="px-4 py-3">{alert.description}</td>
                <td className="px-1 py-3">{getStatusBadge(alert.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertEdit
        isOpen={isEditOpen}
        onClose={handleCloseEdit}
        alertData={editingAlert}
      />
    </div>
  );
}
