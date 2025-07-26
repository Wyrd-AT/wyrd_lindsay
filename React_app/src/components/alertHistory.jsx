import React, { useState } from "react";
import useHistoricoAlertasStore from "../hooks/alertsHistoryStore.js";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import AlertEdit from "./alertEdit.jsx";

export const valueDescriptions = {
  0: "Normal",
  1: "Alarmado",
  2: "Reconhecido",
  3: "Alarme OFF",
  9: "Ausente",
};

export const alarmTypeDescriptions = {
  A: "Tensão abaixo de 50V e PN1 (Lindsay) e PN2 (SFR)",
  B: "Fim-de-curso 1 (SW1)",
  C: "Fim-de-curso 2 (SW2)",
  D: "Memória de Tensão baixa (1 a 8)",
  E: "Torre ausente (não responde à Central)",
};

export default function AlertHistory({ machineId }) {
  const {
    data: historicoAlertas,
    isLoading: isLoadingAlertas,
    error: errorAlertas,
    update: updateAlert,
  } = useHistoricoAlertasStore();

  const [collapsedSections, setCollapsedSections] = useState({});
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);

  if (isLoadingAlertas) {
    return <div className="p-4 text-white">Carregando histórico de alertas...</div>;
  }
  if (errorAlertas) {
    return (
      <div className="p-4 text-red-500">
        Erro ao carregar histórico de alertas: {errorAlertas.message}
      </div>
    );
  }

  // Filtra pelo irrigador (se houver)
  const listaFiltrada = machineId
    ? historicoAlertas.filter((item) => item.irrigadorId === machineId)
    : historicoAlertas;

  // Ordena por data e hora (mais recentes primeiro)
  const listaOrdenada = [...listaFiltrada].sort((a, b) => {
    // transforma de volta em Date para comparar corretamente
    const [dayA, monthA, yearA] = a.date.split("/").map(Number);
    const [dayB, monthB, yearB] = b.date.split("/").map(Number);
    const dateA = new Date(yearA, monthA - 1, dayA, ...a.time.split(":").map(Number));
    const dateB = new Date(yearB, monthB - 1, dayB, ...b.time.split(":").map(Number));
    return dateB - dateA;
  });

  // Agrupa por data formatada (dd/mm/yyyy)
  const agrupadoPorData = listaOrdenada.reduce((acc, item) => {
    acc[item.date] = acc[item.date] || [];
    acc[item.date].push(item);
    return acc;
  }, {});

  const toggleSection = (data) =>
    setCollapsedSections((prev) => ({ ...prev, [data]: !prev[data] }));

  const handleRowClick = (alert) => {
    setEditingAlert(alert);
    setIsEditOpen(true);
  };

  const handleSaveAlert = (updatedAlert) => {
    updateAlert(updatedAlert);
    setIsEditOpen(false);
    setEditingAlert(null);
  };

  const handleCloseEdit = () => {
    setIsEditOpen(false);
    setEditingAlert(null);
  };

  return (
    <div className="overflow-x-auto bg-[#222222] mt-4 p-4 rounded">
      <h2 className="text-xl font-semibold text-white mb-4">Histórico de Alertas</h2>
      <table className="min-w-full table-auto border-collapse">
        <thead>
          <tr className="bg-[#444444]">
            {["Hora", "Código pivô", "Monitor", "Tipo", "Status"].map((col, i) => (
              <th key={i} className="px-4 py-2 text-left font-semibold text-white">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(agrupadoPorData).map(([data, itens]) => {
            const isCollapsed = collapsedSections[data];
            return (
              <React.Fragment key={data}>
                <tr
                  onClick={() => toggleSection(data)}
                  className="cursor-pointer"
                >
                  <td
                    className="px-4 py-2 font-semibold text-white bg-[#333333]"
                    colSpan={5}
                  >
                    {isCollapsed ? <FiChevronDown size={20} /> : <FiChevronUp size={20} />}
                    {" " + data}
                  </td>
                </tr>
                {!isCollapsed &&
                  itens.map((item) => (
                    <tr
                      key={item._id}
                      className="hover:bg-[#444444] cursor-pointer"
                      onClick={() => handleRowClick(item)}
                    >
                      <td className="px-4 py-2 text-white">{item.time}</td>
                      <td className="px-4 py-2 text-white">{item.irrigadorId}</td>
                      <td className="px-4 py-2 text-white">{item.monitor}</td>
                      <td className="px-4 py-2 text-white">
                        {alarmTypeDescriptions[item.alarme] || item.alarme}
                      </td>
                      <td className="px-4 py-2 text-white">
                        {valueDescriptions[item.status] ?? item.status}
                      </td>
                    </tr>
                  ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>

      <AlertEdit
        isOpen={isEditOpen}
        onClose={handleCloseEdit}
        alertData={editingAlert}
      />
    </div>
  );
}
