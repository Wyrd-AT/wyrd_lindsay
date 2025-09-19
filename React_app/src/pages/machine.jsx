import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";

import SideBar from "../components/sidebar";
import BodyContent from "../components/body";
import SelectExport from "../components/selectExport";
import StatusHistory from "../components/statusHistory";
import AlertHistory from "../components/alertHistory";
import MensagemModal from "../components/messageModal";
import SyncProvider from "../components/SyncProvider";
import TensionChart from "../components/TensionChart";

import useVetorSw from "../hooks/vetorSW";
import useVetorTension from "../hooks/VetorTension";
import { useIrrigadores } from "../stores/dataStoreIrrigadores";
import { useAuthStore } from "../stores/authStore";

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { IoMdDownload } from "react-icons/io";

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
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isMensagemOpen, setIsMensagemOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('last24h');

  const swMap = useVetorSw(irrigadorCodes);
  const tensionMap = useVetorTension(irrigadorCodes);



  const selectedDoc = useMemo(
    () => irrigadores.find(doc => doc.codigo === selectedMachineId),
    [irrigadores, selectedMachineId]
  );

  const vectorsSW = useMemo(() => {
    return swMap[selectedMachineId] && swMap[selectedMachineId].vectorsSW ? swMap[selectedMachineId].vectorsSW : [];
  }, [swMap, selectedMachineId]);

  const vectorsTensions = useMemo(() => tensionMap[selectedMachineId]?.vectorsTension ?? [], [tensionMap, selectedMachineId]);

  useEffect(() => {
    const cleanup = () => {
      if (swMap[selectedMachineId]?.cancel) {
        swMap[selectedMachineId].cancel();
      }
      if (tensionMap[selectedMachineId]?.cancel) {
        tensionMap[selectedMachineId].cancel();
      }
    };
    return cleanup;
  }, [swMap, tensionMap, selectedMachineId]);


  useEffect(() => {
    if (irrigadorCodes.length === 0) {
      return;
    }
    if (machineId && irrigadorCodes.includes(machineId)) {
      setSelectedMachineId(machineId);
    } else {
      navigate(`/maquina/${irrigadorCodes[0]}`, { replace: true });
    }
  }, [machineId, irrigadorCodes, navigate]);


  // The conditional return is now safe, as all hooks are defined before it.
  if (!selectedDoc) {
    return (
      <div className="w-full h-screen flex justify-center items-center bg-[#313131] text-white">
        <p>Carregando dados da máquina...</p>
      </div>
    );
  }

  // Logic and constants that depend on hooks can stay here
  const currentLabel = periodOptions.find(opt => opt.value === selectedPeriod)?.label;
  const equipamentos = selectedDoc?.equipamentos ?? [];

  const handleMachineChange = id => {
    setFlash(true);
    navigate(`/maquina/${id}`);
    setTimeout(() => setFlash(false), 200);
  };


  const chartRef = useRef(null);

  const handleExportPDF = async () => {
    try {
      const el = chartRef.current?.getExportElement?.();
      if (!el) {
        console.warn("Elemento do gráfico não encontrado para exportação.");
        return;
      }

      // Captura em alta resolução
      const canvas = await html2canvas(el, {
        scale: 2,               // aumenta a nitidez
        backgroundColor: null,  // mantém fundo transparente se houver
        useCORS: true,          // se houver imagens externas
      });

      const imgData = canvas.toDataURL("image/png");
      // A4 paisagem para gráficos mais largos
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

      const pageWidth = pdf.internal.pageSize.getWidth();   // ~297mm
      const pageHeight = pdf.internal.pageSize.getHeight(); // ~210mm
      const margin = 10;

      // Mantém proporção
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;

      // Centraliza verticalmente (se couber)
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
          onClickDetails={() => setIsDetailsOpen(true)}
          onMessage={() => setIsMensagemOpen(true)}
        />

        <StatusHistory
          selectedMachine={selectedMachineId}
          vetoressw={vectorsSW}
          equipamentos={equipamentos}
          vectorsTensions={vectorsTensions}
        />

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
            className="bg-gray-700 text-white text-sm font-medium px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition" title="Baixar o gráfico em PDF"
          >
            <IoMdDownload />
          </button>
        </div>



        <TensionChart
          currentLabel={currentLabel}
          ref={chartRef}
          irrigadorId={selectedMachineId}
          period={selectedPeriod}
          height={400}
          equipments={equipamentos}
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