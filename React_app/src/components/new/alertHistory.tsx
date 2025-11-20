import React, { useMemo, useState } from "react";
import { useAlertsData } from "../../hooks/new/useAlertsData.js";
import { FiChevronDown, FiChevronUp, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import AlertEdit from "./alertEdit.jsx";
import { useChangesListener } from "../../hooks/new/useChangesListener";
import { IoReload } from "react-icons/io5";

type AlertHistoryProps = {
  machineId: string;
  equipamentos: (string | { nome?: string; name?: string })[];
};

export const valueDescriptions: Record<number, string> = {
  0: "Normal",
  1: "Alarmado",
  2: "Reconhecido",
  3: "Alarme OFF",
  9: "Ausente",
};

export const alarmTypeDescriptions: Record<string, string> = {
  A: "Tensão abaixo de 50V e PN1 (Lindsay) e PN2 (SFR)",
  B: "Fim-de-curso 1 (SW1)",
  C: "Fim-de-curso 2 (SW2)",
  D: "Memória de Tensão baixa (1 a 8)",
  E: "Torre ausente (não responde à Central)",
};

export default function AlertHistory({ machineId, equipamentos }: AlertHistoryProps) {
  // Novo hook com paginação
  const {
    alerts,
    loading,
    error,
    currentPage,
    totalPages,
    totalAlerts,
    goToPage,
    nextPage,
    prevPage,
    refresh
  } = useAlertsData({
    irrigadorId: machineId,
    pageSize: 50
  });

  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<typeof alerts[number] | null>(null);

  // Estados para filtros
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterMonitor, setFilterMonitor] = useState<string>("");
  const [filterDateStart, setFilterDateStart] = useState<string>("");
  const [filterDateEnd, setFilterDateEnd] = useState<string>("");

  // Listener de mudanças do CouchDB para atualização automática de alertas
  useChangesListener({
    db: 'lindsay-data',
    onChange: (changes) => {
      // Verifica se alguma mudança é de evento/alerta para este irrigador
      const hasAlertChange = changes.some(change => {
        const docId = change.id;
        // Documentos de eventos geralmente começam com 'event:' ou 'alarm:'
        // ou contêm o ID do irrigador
        return (
          docId.startsWith('event:') ||
          docId.startsWith('alarm:') ||
          docId.startsWith('evento:') ||
          docId.includes(machineId)
        );
      });

      if (hasAlertChange) {
        console.log('Novo alerta detectado no CouchDB, atualizando histórico...');
        refresh();
      }
    },
    includeDocs: false,
    pollInterval: 5000, // Verifica a cada 5 segundos
    pause: !machineId, // Pausa se não tiver machineId
    onError: (error) => {
      console.error('Erro no listener de mudanças de alertas:', error);
    }
  });

  const resolveMonitorName = useMemo(() => {
    return (rawMonitor: string | number) => {
      if (!Array.isArray(equipamentos) || equipamentos.length === 0) {
        return String(rawMonitor ?? "—");
      }

      const id = Number(rawMonitor);
      if (Number.isNaN(id)) {
        return String(rawMonitor ?? "—");
      }

      let idx;
      if (id === 17) idx = 0;
      else if (id === 18) idx = 1;
      else idx = id + 1;

      if (idx < 0 || idx >= equipamentos.length) {
        return `Ausente`;
      }

      const eq = equipamentos[idx];
      return typeof eq === "string" ? eq : (eq?.nome ?? eq?.name ?? `Ausente`);
    };
  }, [equipamentos]);

  // Aplicar filtros aos alertas
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      // Filtro por tipo de alarme
      if (filterType && alert.alarme !== filterType) {
        return false;
      }

      // Filtro por status
      if (filterStatus && String(alert.status) !== filterStatus) {
        return false;
      }

      // Filtro por monitor
      if (filterMonitor) {
        const monitorName = resolveMonitorName(alert.monitor);
        if (!monitorName.toLowerCase().includes(filterMonitor.toLowerCase())) {
          return false;
        }
      }

      // Filtro por data inicial
      if (filterDateStart) {
        const alertDate = new Date(alert.timestamp);
        const startDate = new Date(filterDateStart);
        if (alertDate < startDate) {
          return false;
        }
      }

      // Filtro por data final
      if (filterDateEnd) {
        const alertDate = new Date(alert.timestamp);
        const endDate = new Date(filterDateEnd);
        endDate.setHours(23, 59, 59, 999); // Incluir o dia todo
        if (alertDate > endDate) {
          return false;
        }
      }

      return true;
    });
  }, [alerts, filterType, filterStatus, filterMonitor, filterDateStart, filterDateEnd, resolveMonitorName]);

  const agrupadoPorData = useMemo(() => {
    return filteredAlerts.reduce((acc: Record<string, typeof alerts>, item) => {
      acc[item.date] = acc[item.date] || [];
      acc[item.date].push(item);
      return acc;
    }, {});
  }, [filteredAlerts]);

  if (loading) {
    return (
      <div className="p-4 text-white bg-[#222222] mt-4 rounded">
        Carregando histórico de alertas...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500 bg-[#222222] mt-4 rounded">
        Erro ao carregar histórico de alertas: {error}
      </div>
    );
  }

  const toggleSection = (data: string): void =>
    setCollapsedSections((prev: Record<string, boolean>) => ({ ...prev, [data]: !prev[data] }));

  const handleRowClick = (alert: typeof alerts[number]): void => {
    setEditingAlert(alert);
    setIsEditOpen(true);
  };



  const handleCloseEdit = () => {
    setIsEditOpen(false);
    setEditingAlert(null);
  };


  return (
    <div className="overflow-x-auto bg-[#222222] mt-4 p-4 rounded">
      <div className="min-w-full flex justify-between align-middle items-center mb-2">
        <h2 className="text-xl font-semibold text-white ">Histórico de Alertas </h2>
        <button
          onClick={refresh}
          className="bg-gray-700 text-white text-sm font-medium px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition"
          >
          <IoReload />

        </button>
      </div>
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
            // ⚠️ FILTRA "Ausente"
            const itensVisiveis = itens.filter(
              (item) => resolveMonitorName(item.monitor) !== "Ausente"
            );

            // se não houver nada visível nessa data, nem mostra a seção
            if (itensVisiveis.length === 0) return null;

            const isCollapsed = collapsedSections[data];
            return (
              <React.Fragment key={data}>
                <tr onClick={() => toggleSection(data)} className="cursor-pointer">
                  <td
                    className="px-4 py-2 font-semibold text-white bg-[#333333]"
                    colSpan={5}
                  >
                    {isCollapsed ? <FiChevronDown size={20} /> : <FiChevronUp size={20} />}
                    {" " + data}
                  </td>
                </tr>

                {!isCollapsed &&
                  itensVisiveis.map((item) => (
                    <tr
                      key={item._id}
                      className="hover:bg-[#444444] cursor-pointer"
                      onClick={() => handleRowClick(item)}
                    >
                      <td className="px-4 py-2 text-white">{item.time}</td>
                      <td className="px-4 py-2 text-white">{item.irrigadorId}</td>
                      <td className="px-4 py-2 text-white">
                        {resolveMonitorName(item.monitor)}
                      </td>
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

      {/* Controles de Paginação */}
      <div className="mt-6 flex items-center justify-between border-t border-gray-700 pt-4">
        <div className="flex items-center gap-4">

          <span className="text-gray-400">
            Total: {totalAlerts} alertas
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={prevPage}
            disabled={currentPage === 1}
            className="p-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed disabled:text-gray-500"
            title="Página anterior"
          >
            <FiChevronLeft size={20} />
          </button>

          <div className="flex items-center gap-2">
            {/* Primeira página */}
            {currentPage > 3 && (
              <>
                <button
                  onClick={() => goToPage(1)}
                  className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
                >
                  1
                </button>
                {currentPage > 4 && <span className="text-gray-500">...</span>}
              </>
            )}

            {/* Páginas ao redor da atual */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(page =>
                page === currentPage ||
                page === currentPage - 1 ||
                page === currentPage + 1 ||
                page === currentPage - 2 ||
                page === currentPage + 2
              )
              .map(page => (
                <button
                  key={page}
                  onClick={() => goToPage(page)}
                  className={`px-3 py-1 rounded ${page === currentPage
                    ? 'bg-green-500 text-white font-bold hover:bg-green-700'
                    : 'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                >
                  {page}
                </button>
              ))}

            {/* Última página */}
            {currentPage < totalPages - 2 && (
              <>
                {currentPage < totalPages - 3 && <span className="text-gray-500">...</span>}
                <button
                  onClick={() => goToPage(totalPages)}
                  className="px-3 py-1 bg-gray-700 text-white rounded hover:bg-gray-600"
                >
                  {totalPages}
                </button>
              </>
            )}
          </div>

          <button
            onClick={nextPage}
            disabled={currentPage === totalPages}
            className="p-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed disabled:text-gray-500"
            title="Próxima página"
          >
            <FiChevronRight size={20} />
          </button>

          <span className="ml-4 text-gray-400">
            Página {currentPage} de {totalPages}
          </span>

        </div>
      </div>

      <AlertEdit
        isOpen={isEditOpen}
        onClose={handleCloseEdit}
        alertData={editingAlert || undefined}
        machineId={machineId}
        equipamentos={equipamentos as any}
      />
    </div>
  );

}
