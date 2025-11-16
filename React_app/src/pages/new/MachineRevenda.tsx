import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { IoMdDownload } from "react-icons/io";

import SideBar from "../../components/new/sidebar.jsx";
import BodyContent from "../../components/new/body.jsx";
import SelectExport from "../../components/new/selectExport.jsx";
import AlertHistory from "../../components/new/alertHistory.js";
import MensagemModal from "../../components/new/messageModal.jsx";

import { getRecentAll } from "../../hooks/new/getRecent.ts";
import { useIrrigadores } from "../../stores/new/dataStoreIrrigadores.js";
import { useAuthStore } from "../../stores/new/authStore.ts";
import { useTensionData } from "../../hooks/new/useTensionData.ts";
import Overview from "../../components/new/Overview.tsx";
import TensionTimeChart from "../../components/new/TensionTimeChart.tsx";

type RecentSWDoc = {
  data?: any;
  updated_at?: string;
  vectorsSW?: any[];
};

type RecentTensaoDoc = {
  data?: any;
  updated_at?: string;
  vectorsTension?: any[];
};

const periodOptions = [
  { value: 'last24h', label: '24 h' },
  { value: 'last7d', label: '7 dias' },
  { value: 'last30d', label: '30 dias' },
];

export default function MaquinaRevenda() {
  const navigate = useNavigate();
  const { machineId } = useParams();
  const { companyId } = useAuthStore();
  const irrigadores = useIrrigadores(companyId);
  const irrigadorCodes = useMemo(() => irrigadores.map(i => i.codigo), [irrigadores]);

  const [selectedMachineId, setSelectedMachineId] = useState(machineId || null);
  const [flash, setFlash] = useState(false);
  const [isMensagemOpen, setIsMensagemOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('last24h');

  const [swDoc, setSwDoc] = useState<RecentSWDoc | null>(null);
  const [tensionDocA, setTensionDocA] = useState<RecentTensaoDoc | null>(null);
  const [tensionDocB, setTensionDocB] = useState<RecentTensaoDoc | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [errorData, setErrorData] = useState<string | null>(null);

  //console.log("Rendering MaquinaRevenda for machineId:", selectedMachineId);

  const selectedDoc = useMemo(
    () => irrigadores.find(doc => doc.codigo === selectedMachineId),
    [irrigadores, selectedMachineId]
  );

  //console.log("Selected Document:", selectedDoc);



  //console.log(machineId)
  //console.log(selectedPeriod)
  const { pointsA, pointsB, loading, error, refresh } = useTensionData({
    irrigadorId: String(machineId),
    period: String(selectedPeriod),
    limit: 1000, // Busca até 500, mas exibe 200 (decimação no chart)
    equipmentNames: selectedDoc?.equipamentos || [],
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!selectedMachineId || !companyId) return;

      setLoadingData(true);
      setErrorData(null);

      try {
        const all = await getRecentAll("lindsay-data", String(selectedMachineId));
        if (!alive) return;

        setSwDoc(all.sw ?? null);
        setTensionDocA(all.tensao.A ?? null);
        setTensionDocB(all.tensao.B ?? null);
      } catch (e: any) {
        if (alive) setErrorData(e?.message ?? 'Falha ao carregar dados recentes');
      } finally {
        if (alive) setLoadingData(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [selectedMachineId, companyId]);

  useEffect(() => {
    if (irrigadorCodes.length === 0) return;

    if (machineId && irrigadorCodes.includes(machineId)) {
      setSelectedMachineId(machineId);
    } else {
      navigate(`/maquina/${irrigadorCodes[0]}`, { replace: true });
    }
  }, [machineId, irrigadorCodes, navigate]);

  // ✅ Hooks BEFORE early returns
  const chartRef = useRef(null);

  const currentLabel = useMemo(
    () => periodOptions.find(opt => opt.value === selectedPeriod)?.label,
    [selectedPeriod]
  );

  const equipamentos = useMemo(
    () => selectedDoc?.equipamentos ?? [],
    [selectedDoc]
  );

  //console.log("Equipamentos:", equipamentos);

  const handleMachineChange = (id: string) => {
    setFlash(true);
    navigate(`/maquina/${id}`);
    setTimeout(() => setFlash(false), 200);
  };

  const handleExportPDF = async () => {
    try {
      const el = chartRef.current?.getExportElement?.();
      if (!el) {
        console.warn("Elemento do gráfico não encontrado para exportação.");
        return;
      }

      const canvas = await html2canvas(el, {
        scale: 2,
        backgroundColor: null,
        useCORS: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;

      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;
      const y = Math.max(margin, (pageHeight - imgHeight) / 2);

      pdf.addImage(imgData, "PNG", margin, y, imgWidth, imgHeight);

      const fileName =
        chartRef.current?.getFileName?.() ||
        `tensoes_${selectedMachineId}_${selectedPeriod}.pdf`;

      pdf.save(fileName);
    } catch (err) {
      console.error("Falha ao gerar PDF do gráfico:", err);
    }
  };
  //console.log("############### Equipamentos:", equipamentos);
  //console.log(!selectedDoc);

  // ✅ Early return AFTER all hooks
  if (!selectedDoc) {
    return (
      <div className="w-full h-screen flex justify-center items-center bg-[#313131] text-white">
        <p>Carregando dados da máquina...</p>
      </div>
    );
  }

  //console.log(pointsA, pointsB);


  return (
    <div
      className={`w-full h-full text-white flex bg-[#313131]
        transition-opacity duration-200
        ${flash ? "opacity-50" : "opacity-100"}`}
      key={selectedMachineId}
    >
      <SideBar />

      <BodyContent>
        <SelectExport
          machines={irrigadorCodes}
          selectedMachine={selectedMachineId}
          getDisplayName={id => `Pivô ${id}`}
          redirectBase="/maquina"
          onMachineChange={handleMachineChange}
          onclick_details={() => {}}
          onExport={() => {}}
          onMessage={() => setIsMensagemOpen(true)}
        />

        <Overview
          pivoId={selectedMachineId}
    
        />

         {loadingData && (
          <div className="text-center py-2 text-gray-400 text-sm">
            Carregando dados...
          </div>
        )}

        {errorData && (
          <div className="text-center py-2 text-red-400 text-sm">
            {errorData}
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center mt-4 py-4 px-2 bg-[#222222] rounded-t-lg">
          <div className="flex items-center">
            <label htmlFor="periodSelect" className="mr-2 text-white">
              Período:
            </label>
            <select
              id="periodSelect"
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
              className="bg-gray-700 text-white p-0.5 rounded"
            >
              {periodOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleExportPDF}
            className="bg-gray-700 text-white text-sm font-medium px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition"
            title="Baixar o gráfico em PDF"
          >
            <IoMdDownload />
          </button>
        </div>

        <TensionTimeChart
          currentLabel={currentLabel}
          ref={chartRef}
          irrigadorId={selectedMachineId}
          period={selectedPeriod}
          height={400}
          equipmentNames={equipamentos}
          pointsA={pointsA}
          pointsB={pointsB}
        />
        <AlertHistory machineId={selectedMachineId} equipamentos={equipamentos} />
      </BodyContent>

      <MensagemModal
        isOpen={isMensagemOpen}
        onClose={() => setIsMensagemOpen(false)}
        selectedMachine={selectedMachineId}
      /> 
    </div>
  );
}