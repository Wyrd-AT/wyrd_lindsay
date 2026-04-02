import React, { useMemo, useState } from "react";
import {
  useAuthStore,
  selectCanExportReports,
} from "../../stores/new/authStore";
import {
  useAlertsData,
  convertEventToAlert,
} from "../../hooks/new/useAlertsData.js";
import {
  FiChevronDown,
  FiChevronUp,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import AlertEdit from "./alertEdit.jsx";
import { useChangesListener } from "../../hooks/new/useChangesListener";
import { IoReload } from "react-icons/io5";
import {
  valueDescriptions,
  alarmTypeDescriptions,
} from "../../constants/alertDescriptions";

import { getAlertHistory } from "../../hooks/new/getHistory.js";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { IoMdDownload } from "react-icons/io";
import logoImg from "../../assets/fieldnet.webp";
import { format } from "date-fns";

type AlertHistoryProps = {
  machineId: string;
  pivoName?: string;
  equipamentos: (string | { nome?: string; name?: string })[];
};

export default function AlertHistory({
  machineId,
  pivoName,
  equipamentos,
}: AlertHistoryProps) {
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
    refresh,
  } = useAlertsData({
    irrigadorId: machineId,
    pageSize: 50,
  });

  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({});
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<
    (typeof alerts)[number] | null
  >(null);

  // Estados para filtros
  const [filterType] = useState<string>("");
  const [filterStatus] = useState<string>("");
  const [filterMonitor] = useState<string>("");
  const [filterDateStart] = useState<string>("");
  const [filterDateEnd] = useState<string>("");

  const canExportReports = useAuthStore(selectCanExportReports);

  const [isDownloading, setIsDownloading] = useState(false);
  const handleDownloadFullPdf = async () => {
    try {
      setIsDownloading(true);

      const docs = await getAlertHistory("lindsay-data", {
        irrigadorId: machineId,
        table: "events",
        sort: "desc",
        limit: 100000,
      });

      const fullData = docs
        .map((doc) => convertEventToAlert(doc))
        .filter((item) => item !== null);

      if (fullData.length === 0) {
        alert("Sem dados para exportar.");
        setIsDownloading(false);
        return;
      }

      const doc = new jsPDF();

      try {
        doc.addImage(logoImg, "WEBP", 5, 0, 80, 40);
      } catch (e) {
        console.warn("Erro ao carregar logo", e);
      }

      doc.setFontSize(10);
      doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 40);

      const getMonitorNameForPdf = (rawMonitor: any) => {
        if (!Array.isArray(equipamentos) || equipamentos.length === 0) {
          return String(rawMonitor ?? "—");
        }
        const id = Number(rawMonitor);
        if (Number.isNaN(id)) return String(rawMonitor ?? "—");

        let idx;
        if (id === 17) idx = 0;
        else if (id === 18) idx = 1;
        else idx = id + 1;

        if (idx < 0 || idx >= equipamentos.length) return `Ausente`;
        const eq = equipamentos[idx];
        return typeof eq === "string"
          ? eq
          : (eq?.nome ?? eq?.name ?? `Ausente`);
      };
      // -------------------------------------------------------------

      const tableBody = fullData.map((item) => {
        const monitorDesc = getMonitorNameForPdf(item.monitor);
        const tipoDesc = alarmTypeDescriptions[item.alarme] || item.alarme;
        const statusDesc = valueDescriptions[item.estado] ?? item.estado;

        return [
          item.date,
          item.time,
          item.irrigadorId,
          monitorDesc, // Nome do monitor
          tipoDesc, // Descrição do erro
          statusDesc, // Status por extenso
        ];
      });

      autoTable(doc, {
        startY: 45,
        head: [["Data", "Hora", "Pivô", "Monitor", "Tipo", "Status"]],
        body: tableBody,
        theme: "striped",
        headStyles: { fillColor: [50, 50, 50] }, // Cabeçalho cinza escuro
        styles: { fontSize: 8 },
      });

      const fileName = `historico_alertas_${machineId}_${format(new Date(), "dd-MM-yyyy_HH-mm-ss")}.pdf`;

      doc.save(fileName);
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar PDF");
    } finally {
      setIsDownloading(false);
    }
  };

  // Listener de mudanças do CouchDB para atualização automática de alertas
  useChangesListener({
    db: "lindsay-data",
    onChange: (changes) => {
      // Verifica se alguma mudança é de evento/alerta para este irrigador
      const hasAlertChange = changes.some((change) => {
        const docId = change.id;
        // Documentos de eventos geralmente começam com '' ou 'alarm:'
        // ou contêm o ID do irrigador
        return (
          docId.startsWith("event:") ||
          docId.startsWith("alarm:") ||
          docId.startsWith("evento:") ||
          docId.includes(machineId)
        );
      });

      if (hasAlertChange) {
        refresh();
      }
    },
    includeDocs: false,
    pollInterval: 5000, // Verifica a cada 5 segundos
    pause: !machineId, // Pausa se não tiver machineId
    onError: (error) => {
      console.error("Erro no listener de mudanças de alertas:", error);
    },
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
    return alerts.filter((alert) => {
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
  }, [
    alerts,
    filterType,
    filterStatus,
    filterMonitor,
    filterDateStart,
    filterDateEnd,
    resolveMonitorName,
  ]);

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
    setCollapsedSections((prev: Record<string, boolean>) => ({
      ...prev,
      [data]: !prev[data],
    }));

  const handleRowClick = (alert: (typeof alerts)[number]): void => {
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
        <h2 className="text-xl font-semibold text-white ">
          Histórico de Alertas{" "}
        </h2>
        <div className="flex gap-2">
          {canExportReports && (
            <button
              onClick={handleDownloadFullPdf}
              disabled={isDownloading}
              className="bg-gray-700 text-white text-sm font-medium px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition"
            >
              <IoMdDownload />
            </button>
          )}
          <button
            onClick={refresh}
            className="bg-gray-700 text-white text-sm font-medium px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition"
          >
            <IoReload />
          </button>
        </div>
      </div>
      <table className="min-w-full table-auto border-collapse">
        <thead>
          <tr className="bg-[#444444]">
            {["Hora", "Código pivô", "Monitor", "Tipo", "Status"].map(
              (col, i) => (
                <th
                  key={i}
                  className="px-4 py-2 text-left font-semibold text-white"
                >
                  {col}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {Object.entries(agrupadoPorData).map(([data, itens]) => {
            // ⚠️ FILTRA "Ausente"
            const itensVisiveis = itens.filter(
              (item) => resolveMonitorName(item.monitor) !== "Ausente",
            );

            console.log(itensVisiveis);

            // se não houver nada visível nessa data, nem mostra a seção
            if (itensVisiveis.length === 0) return null;

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
                    {isCollapsed ? (
                      <FiChevronDown size={20} />
                    ) : (
                      <FiChevronUp size={20} />
                    )}
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
                      <td className="px-4 py-2 text-white">
                        {item.irrigadorId}
                      </td>
                      <td className="px-4 py-2 text-white">
                        {resolveMonitorName(item.monitor)}
                      </td>
                      <td className="px-4 py-2 text-white">
                        {alarmTypeDescriptions[item.alarme] || item.alarme}
                      </td>
                      <td className="px-4 py-2 text-white">
                        {valueDescriptions[item.estado] ?? item.estado}
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
          <span className="text-gray-400">Total: {totalAlerts} alertas</span>
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
              .filter(
                (page) =>
                  page === currentPage ||
                  page === currentPage - 1 ||
                  page === currentPage + 1 ||
                  page === currentPage - 2 ||
                  page === currentPage + 2,
              )
              .map((page) => (
                <button
                  key={page}
                  onClick={() => goToPage(page)}
                  className={`px-3 py-1 rounded ${
                    page === currentPage
                      ? "bg-green-500 text-white font-bold hover:bg-green-700"
                      : "bg-gray-700 text-white hover:bg-gray-600"
                  }`}
                >
                  {page}
                </button>
              ))}

            {/* Última página */}
            {currentPage < totalPages - 2 && (
              <>
                {currentPage < totalPages - 3 && (
                  <span className="text-gray-500">...</span>
                )}
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
        alertData={editingAlert ?? undefined}
        machineId={machineId}
        pivoName={pivoName}
        equipamentos={equipamentos as any}
      />
    </div>
  );
}
