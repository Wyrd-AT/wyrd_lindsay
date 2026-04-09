import { useEffect, useMemo, useState } from "react";
import {
  useAuthStore,
  selectCanExportReports,
} from "../../stores/new/authStore";
import { useAlertsData, AlertItem } from "../../hooks/new/useAlertsData.js";
import { FiChevronLeft, FiChevronRight, FiX } from "react-icons/fi";
import AlertEdit from "./alertEdit.jsx";
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
  irrigadorId?: string;
  pivoName?: string;
  equipamentos: (string | { nome?: string; name?: string })[];
  externalRefreshTick?: number;
};

function equipLabel(e: AlertHistoryProps["equipamentos"][number]): string {
  if (typeof e === "string") return e;
  return e.nome ?? e.name ?? "—";
}

// ─── Modal de histórico por equipamento ───────────────────────────────────────

function HistoryModal({
  irrigadorId,
  machineId,
  pivoName,
  equipamentos,
  monitorName,
  monitorRaw,
  onClose,
}: {
  irrigadorId: string;
  machineId: string;
  pivoName?: string;
  equipamentos: AlertHistoryProps["equipamentos"];
  monitorName: string;
  monitorRaw: string;
  onClose: () => void;
}) {
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
  } = useAlertsData({ irrigadorId, pageSize: 50, monitor: monitorRaw });

  // Fecha com ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const visibleAlerts = useMemo(
    () => alerts.filter((a) => a.monitor_name !== "Ausente"),
    [alerts],
  );

  useEffect(() => {
    if (visibleAlerts.length === 0) return;
    console.log("[AlertHistory] visibleAlerts sample:", visibleAlerts[0]);
  }, [visibleAlerts]);

  const fmtMaybeDate = (value: any) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("pt-BR");
  };

  const [latestAlert, setLatestAlert] = useState<AlertItem | null>(null);

  useEffect(() => {
    if (currentPage !== 1) return;
    if (!loading && !error && visibleAlerts.length > 0) {
      setLatestAlert(visibleAlerts[0]);
    }
    if (!loading && visibleAlerts.length === 0) {
      setLatestAlert(null);
    }
  }, [currentPage, loading, error, visibleAlerts]);


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#222222] rounded-lg w-4/5  max-h-[85vh] flex flex-col shadow-xl mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 ">
          <div className="flex items-center gap-2">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Agendamento — <span className="text-green-400">{monitorName}</span>
              </h2>
              <p className="text-gray-400 text-sm">{totalAlerts} alertas encontrados</p>
              <p className="text-gray-500 text-xs">
                Agendamento usa sempre o último alerta deste equipamento.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="p-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition"
            >
              <IoReload size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition"
              aria-label="Fechar"
            >
              <FiX size={18} />
            </button>
          </div>
        </div>

        {/* Corpo — agendamento do último + histórico (não clicável) */}
        <div className="overflow-y-auto flex-1 px-5 py-3">
          {loading ? (
            <p className="text-gray-400 py-4">Carregando...</p>
          ) : error ? (
            <p className="text-red-400 py-4">{error}</p>
          ) : visibleAlerts.length === 0 || !latestAlert ? (
            <p className="text-gray-400 py-4">Nenhum alerta para este equipamento.</p>
          ) : (
            <>
              <div className="rounded-md border border-[#333333] mb-4">
                <AlertEdit
                  isOpen={true}
                  embedded={true}
                  onClose={onClose}
                  alertData={latestAlert as any}
                  machineId={machineId}
                  pivoName={pivoName}
                  equipamentos={equipamentos as any}
                />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-2">
                  Histórico (somente visualização)
                </p>
                <table className="min-w-full table-auto border-collapse">
                  <thead>
                    <tr className="bg-[#333333]">
                      {[
                        "Data",
                        "Hora",
                        "Tipo",
                        "Status",
                        "Agendamento",
                        "Resp. agendamento",
                        "Intervalo",
                        "Data solução",
                        "Resp. solução",
                      ].map((col, i) => (
                        <th key={i} className="px-4 py-2 text-left text-sm font-semibold text-white">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleAlerts.map((item) => (
                      <tr key={item._id} className="border-b border-gray-700">
                        <td className="px-4 py-2 text-white text-sm">{item.date}</td>
                        <td className="px-4 py-2 text-white text-sm">{item.time}</td>
                        <td className="px-4 py-2 text-white text-sm">
                          {alarmTypeDescriptions[item.alarme] || item.alarme}
                        </td>
                        <td className="px-4 py-2 text-white text-sm">
                          {valueDescriptions[item.estado] ?? item.estado}
                        </td>
                        <td className="px-4 py-2 text-white text-sm">
                          {fmtMaybeDate(item.scheduled_for || item.ultimo_agendamento)}
                        </td>
                        <td className="px-4 py-2 text-white text-sm">
                          {item.responsavel_agendamento || "—"}
                        </td>
                        <td className="px-4 py-2 text-white text-sm">
                          {item.timer_value ? `${item.timer_value} min` : "—"}
                        </td>
                        <td className="px-4 py-2 text-white text-sm">
                          {fmtMaybeDate(item.data_solucao)}
                        </td>
                        <td className="px-4 py-2 text-white text-sm">
                          {item.responsavel_solucao || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-700">
            <button
              onClick={prevPage}
              disabled={currentPage === 1}
              className="p-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FiChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => Math.abs(p - currentPage) <= 2)
                .map((p) => (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`px-3 py-1 rounded text-sm ${
                      p === currentPage
                        ? "bg-green-500 text-white font-bold"
                        : "bg-gray-700 text-white hover:bg-gray-600"
                    }`}
                  >
                    {p}
                  </button>
                ))}
            </div>
            <button
              onClick={nextPage}
              disabled={currentPage === totalPages}
              className="p-2 bg-gray-700 text-white rounded hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FiChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AlertHistory({
  machineId,
  irrigadorId,
  pivoName,
  equipamentos,
  externalRefreshTick,
}: AlertHistoryProps) {
  const effectiveIrrigadorId = irrigadorId ?? machineId;
  const canExportReports = useAuthStore(selectCanExportReports);

  // Carrega alertas recentes (1 página grande para montar o resumo)
  const { alerts, loading, error, refresh } = useAlertsData({
    irrigadorId: effectiveIrrigadorId,
    pageSize: 200,
  });

  const [modal, setModal] = useState<{ monitorName: string; monitorRaw: string } | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (externalRefreshTick && externalRefreshTick > 0) refresh();
  }, [externalRefreshTick, refresh]);

  // Índice: monitor_name → alerta mais recente
  const lastByMonitor = useMemo(() => {
    const map = new Map<string, AlertItem>();
    for (const a of alerts) {
      if (a.monitor_name === "Ausente") continue;
      const key = a.monitor_name || String(a.monitor ?? "");
      if (!map.has(key)) map.set(key, a); // desc → primeiro = mais recente
    }
    return map;
  }, [alerts]);

  const handleDownloadFullPdf = async () => {
    try {
      setIsDownloading(true);
      const batchSize = 500;
      const allItems: any[] = [];
      let skip = 0;
      let batch: Awaited<ReturnType<typeof getAlertHistory>>;
      do {
        batch = await getAlertHistory({ irrigadorId: effectiveIrrigadorId, limit: batchSize, skip });
        allItems.push(...batch.items);
        skip += batchSize;
      } while (batch.items.length === batchSize);

      if (allItems.length === 0) { alert("Sem dados para exportar."); return; }

      const doc = new jsPDF();
      try { doc.addImage(logoImg, "WEBP", 5, 0, 80, 40); } catch {}
      doc.setFontSize(10);
      doc.text(`Gerado em: ${new Date().toLocaleString()}`, 14, 40);
      autoTable(doc, {
        startY: 45,
        head: [["Data", "Hora", "Pivô", "Monitor", "Tipo", "Status"]],
        body: allItems.map((i) => [
          i.date, i.time, i.irrigadorId,
          i.monitor_name || String(i.monitor ?? "—"),
          alarmTypeDescriptions[i.alarme] || i.alarme,
          valueDescriptions[i.estado] ?? i.estado,
        ]),
        theme: "striped",
        headStyles: { fillColor: [50, 50, 50] },
        styles: { fontSize: 8 },
      });
      doc.save(`historico_alertas_${machineId}_${format(new Date(), "dd-MM-yyyy_HH-mm-ss")}.pdf`);
    } catch { alert("Erro ao gerar PDF"); }
    finally { setIsDownloading(false); }
  };

  return (
    <div className="overflow-x-auto bg-[#222222] mt-4 p-4 rounded">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-white">Histórico de Alertas</h2>
        <div className="flex gap-2">
          {canExportReports && (
            <button
              onClick={handleDownloadFullPdf}
              disabled={isDownloading}
              className="bg-gray-700 text-white text-sm px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition"
            >
              <IoMdDownload />
            </button>
          )}
          <button
            onClick={refresh}
            className="bg-gray-700 text-white text-sm px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition"
          >
            <IoReload />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Carregando...</p>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : (
        <table className="min-w-full table-auto border-collapse">
          <thead>
            <tr className="bg-[#444444]">
              {["Equipamento", "Último alerta", "Hora", "Tipo", "Status"].map((col, i) => (
                <th key={i} className="px-4 py-2 text-left font-semibold text-white text-sm">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {equipamentos.map((eq, idx) => {
              const label = equipLabel(eq);
              const last = lastByMonitor.get(label);
              return (
                <tr
                  key={idx}
                  className="border-b border-gray-700 hover:bg-[#2e4a3e] cursor-pointer"
                  onClick={() => {
                    const monitorRaw = last ? String(last.monitor ?? "") : String(idx);
                    setModal({ monitorName: label, monitorRaw });
                  }}
                >
                  <td className="px-4 py-3 text-white text-sm">
                    {label}
                  </td>
                  <td className="px-4 py-3 text-white text-sm">{last?.date ?? "—"}</td>
                  <td className="px-4 py-3 text-white text-sm">{last?.time ?? "—"}</td>
                  <td className="px-4 py-3 text-white text-sm">
                    {last ? (alarmTypeDescriptions[last.alarme] || last.alarme) : "—"}
                  </td>
                  <td className="px-4 py-3 text-white text-sm">
                    {last ? (valueDescriptions[last.estado] ?? last.estado) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {modal && (
        <HistoryModal
          irrigadorId={effectiveIrrigadorId}
          machineId={machineId}
          pivoName={pivoName}
          equipamentos={equipamentos}
          monitorName={modal.monitorName}
          monitorRaw={modal.monitorRaw}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
