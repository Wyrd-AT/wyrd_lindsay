import React, { useState, useEffect } from "react";
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
    historicoAlertas,
    isLoading: isLoadingAlertas,
    error: errorAlertas,
    updateAlert,
  } = useHistoricoAlertasStore();

  const [collapsedSections, setCollapsedSections] = useState({});
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);
  const [refreshData, setRefreshData] = useState(false); // Adicionado para forçar atualização

  // Verificação de carregamento e erro
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

  // Funções auxiliares para formatar a data e hora (Declarar aqui antes de usar)
  const formatDate = isoString =>
    new Date(isoString).toLocaleDateString("pt-BR");

  const formatTime = isoString =>
    new Date(isoString).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });

  // Filtra os alertas de acordo com o machineId (se fornecido)
  const listaFiltrada = machineId
    ? historicoAlertas.filter(item => item.irrigadorId === machineId)
    : historicoAlertas;

  // Ordena os alertas pela data
  const listaOrdenada = [...listaFiltrada].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  // Agrupa os alertas por data formatada
  const agrupadoPorData = listaOrdenada.reduce((acc, item) => {
    const data = formatDate(item.date); // Agora está disponível
    if (!acc[data]) acc[data] = [];
    acc[data].push(item);
    return acc;
  }, {});

  // Função para salvar o alerta e forçar a atualização dos dados
  const handleSaveAlert = (updatedAlert) => {
    updateAlert(updatedAlert);  // Atualiza o alerta no estado global e localStorage
    setIsEditOpen(false);  // Fecha o modal após salvar
    setEditingAlert(null); // Limpa o alerta em edição
    setRefreshData(prev => !prev); // Altera o estado para forçar o recarregamento dos dados
  };

  // Toggle de seção (expandir/recolher)
  const toggleSection = (data) => {
    setCollapsedSections(prev => ({
      ...prev,
      [data]: !prev[data],
    }));
  };

  const handleRowClick = (alert) => {
    setEditingAlert(alert);
    setIsEditOpen(true);
  };

  function handleCloseEdit() {
    setIsEditOpen(false);
    setEditingAlert(null);
  }

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
                <tr onClick={() => toggleSection(data)} className="cursor-pointer">
                  <td className="px-4 py-2 font-semibold text-white bg-[#333333]" colSpan={5}>
                    <span className="inline-block mr-2">
                      {isCollapsed ? <FiChevronDown size={20} /> : <FiChevronUp size={20} />}
                    </span>
                    {data}
                  </td>
                </tr>

                {/* Renderiza o conteúdo apenas se a seção não estiver recolhida */}
                {!isCollapsed && itens.map((item, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-[#444444] cursor-pointer"
                    onClick={() => handleRowClick(item)}
                  >
                    <td className="px-4 py-2 text-white">{formatTime(item.date)}</td>
                    <td className="px-4 py-2 text-white">{item.irrigadorId}</td>
                    <td className="px-4 py-2 text-white">{item.monitor}</td>
                    <td className="px-4 py-2 text-white">{alarmTypeDescriptions[item.alarme] || item.alarme}</td>
                    <td className="px-4 py-2 text-white">{valueDescriptions[item.status] ?? item.status}</td>
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
        onSave={handleSaveAlert} // Passa a função handleSaveAlert para o componente AlertEdit
      />
    </div>
  );
}
