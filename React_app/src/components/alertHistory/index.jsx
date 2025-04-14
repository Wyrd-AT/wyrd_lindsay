import React, { useState } from "react";
import { FiAlertOctagon, FiEdit2 } from "react-icons/fi"; // Ícone de edição
import { FaChevronDown } from "react-icons/fa"; // Ícone para dropdown
import AlertEdit from "../alertEdit";

// Exemplo de dados mockados
const mockAlerts = [
  {
    id: 1,
    date: "18/03/2025",
    time: "18:41",
    machine: "IRRIGADOR 1",
    description: "Nome do tipo de alerta",
    status: "Não resolvido",
    checked: true,
  },
  {
    id: 2,
    date: "18/03/2025",
    time: "18:41",
    machine: "IRRIGADOR 1",
    description: "Nome do tipo de alerta",
    status: "Em progresso",
    checked: false,
  },
  {
    id: 3,
    date: "18/03/2025",
    time: "18:41",
    machine: "IRRIGADOR 1",
    description: "Nome do tipo de alerta",
    status: "Resolvido",
    checked: false,
  },
  {
    id: 4,
    date: "18/03/2025",
    time: "18:41",
    machine: "IRRIGADOR 1",
    description: "Nome do tipo de alerta",
    status: "Resolvido",
    checked: false,
  },
  {
    id: 5,
    date: "18/03/2025",
    time: "18:41",
    machine: "IRRIGADOR 1",
    description: "Nome do tipo de alerta",
    status: "Não resolvido",
    checked: false,
  },
  {
    id: 6,
    date: "18/03/2025",
    time: "18:41",
    machine: "IRRIGADOR 1",
    description: "Nome do tipo de alerta",
    status: "Não resolvido",
    checked: false,
  },
  {
    id: 7,
    date: "18/03/2025",
    time: "18:41",
    machine: "IRRIGADOR 1",
    description: "Nome do tipo de alerta",
    status: "Não resolvido",
    checked: false,
  },
  {
    id: 8,
    date: "18/03/2025",
    time: "18:41",
    machine: "IRRIGADOR 1",
    description: "Nome do tipo de alerta",
    status: "Não resolvido",
    checked: false,
  },
  {
    id: 9,
    date: "18/03/2025",
    time: "18:41",
    machine: "IRRIGADOR 1",
    description: "Nome do tipo de alerta",
    status: "Não resolvido",
    checked: false,
  },
  {
    id: 10,
    date: "18/03/2025",
    time: "18:41",
    machine: "IRRIGADOR 1",
    description: "Nome do tipo de alerta",
    status: "Não resolvido",
    checked: false,
  },
  {
    id: 13,
    date: "18/03/2025",
    time: "18:41",
    machine: "IRRIGADOR 1",
    description: "Nome do tipo de alerta",
    status: "Não resolvido",
    checked: false,
  },
  {
    id: 11,
    date: "18/03/2025",
    time: "18:41",
    machine: "IRRIGADOR 1",
    description: "Nome do tipo de alerta",
    status: "Não resolvido",
    checked: false,
  },
  {
    id: 12,
    date: "18/03/2025",
    time: "18:41",
    machine: "IRRIGADOR 1",
    description: "Nome do tipo de alerta",
    status: "Não resolvido",
    checked: false,
  },
];

// Função auxiliar para estilizar o status
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

export default function AlertHistory() {
  const [alerts, setAlerts] = useState(mockAlerts);
  const [selectedStatus, setSelectedStatus] = useState("Todos");
  const [isAlertEditOpen, setAlertEditOpen] = useState(false);

  // Filtragem simples dos alertas
  const filteredAlerts = alerts.filter((alert) => {
    if (selectedStatus === "Todos") return true;
    return alert.status === selectedStatus;
  });

  // Função para alterar o estado do checkbox
  const handleCheck = (id) => {
    setAlerts((prev) =>
      prev.map((alert) =>
        alert.id === id ? { ...alert, checked: !alert.checked } : alert
      )
    );
  };

  return (
    <div className="bg-[#313131] text-white p-8 rounded-md w-full">
      <div className="flex items-center pb-4">
        <FiAlertOctagon />
        <h2 className="text-xl font-semibold pl-4">HISTÓRICO DE ALERTAS</h2>
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4 ml-4">
        {/* Botões de status */}
        <div className="bg-[#616061] p-2 rounded-lg">
          <button
            onClick={() => setSelectedStatus("Não resolvido")}
            className={`px-3 py-1 rounded-lg ${
              selectedStatus === "Não resolvido"
                ? "bg-white text-[#444444]"
                : "bg-[#616061]"
            }`}
          >
            Não resolvido
          </button>
          <button
            onClick={() => setSelectedStatus("Em progresso")}
            className={`px-3 py-1 rounded-lg ${
              selectedStatus === "Em progresso"
                ? "bg-white text-[#444444]"
                : "bg-[#616061]"
            }`}
          >
            Em progresso
          </button>
          <button
            onClick={() => setSelectedStatus("Resolvido")}
            className={`px-3 py-1 rounded-lg ${
              selectedStatus === "Resolvido"
                ? "bg-white text-[#444444]"
                : "bg-[#616061]"
            }`}
          >
            Resolvido
          </button>
        </div>

        {/* Seletor de Data (simulação) */}
        <div className="relative">
          <button className="bg-[#444444] px-3 py-2 rounded inline-flex items-center">
            Data <FaChevronDown className="text-sm" />
          </button>
        </div>

        {/* Seletor de Irrigador (simulação) */}
        <div className="relative">
          <button className="bg-[#444444] px-3 py-2 rounded inline-flex items-center gap-1">
            Irrigador <FaChevronDown className="text-sm" />
          </button>
        </div>

        {/* Botão de editar alerta que abre o modal */}
        <button
          onClick={() => setAlertEditOpen(true)}
          className="border border-white px-3 py-1 rounded-full ml-auto inline-flex items-center gap-1 hover:bg-gray-600 transition-colors"
        >
          <div className="px-4">editar alerta</div>
          <FiEdit2 size={20} />
        </button>
      </div>

      {/* Tabela de alertas */}
      <div className="overflow-x-auto ml-4">
        <table className="w-full text-left">
          <thead className="bg-[#444444] text-sm uppercase">
            <tr>
              <th className="px-4 py-2 w-12">
                <input type="checkbox" className="cursor-pointer" />
              </th>
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
                className="border-b border-gray-600 last:border-b-0"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    className="cursor-pointer"
                    checked={alert.checked}
                    onChange={() => handleCheck(alert.id)}
                  />
                </td>
                <td className="px-4 py-3">{alert.date}</td>
                <td className="px-4 py-3">{alert.time}</td>
                <td className="px-4 py-3">{alert.machine}</td>
                <td className="px-4 py-3">{alert.description}</td>
                <td className="px-4 py-3">{getStatusBadge(alert.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal de edição */}
      <AlertEdit isOpen={isAlertEditOpen} onClose={() => setAlertEditOpen(false)} />
    </div>
  );
}
