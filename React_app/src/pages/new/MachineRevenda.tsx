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
import Overview from "../../components/new/Overview.tsx";
import TensionTimeChart from "../../components/new/TensionTimeChart.tsx";

import { getRecentAll } from "../../hooks/new/getRecent.ts";
import { useIrrigadores } from "../../stores/new/dataStoreIrrigadores.js";
import { useAuthStore } from "../../stores/new/authStore.ts";
import { useTensionData } from "../../hooks/new/useTensionData.ts";
import { useChangesListener } from "../../hooks/new/useChangesListener";
import { Irrigador } from "../../helpers/helperOverview.tsx";


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
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const { machineId } = useParams();

  const cnpjCliente = user?.cnpj ?? '';
  const irrigadores = useIrrigadores(cnpjCliente);

  const [flash, setFlash] = useState(false);
  const [isMensagemOpen, setIsMensagemOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState('last24h');
  const [errorData, setErrorData] = useState<string | null>(null);


  useEffect(() => {
    if (!isAuthenticated || !cnpjCliente || !user) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  const selectedDoc = useMemo<Irrigador | undefined>(
    () => (irrigadores as Irrigador[]).find((doc) => String(doc.codigo) === String(machineId)),
    [irrigadores, machineId]
  );


  //console.log("Selected Document:", selectedDoc);

  const chartRef = useRef(null);


  const equipamentos = useMemo(() => {
    const arr = Array.isArray(selectedDoc?.equipamentos) ? selectedDoc.equipamentos : [];
    if (arr.length >= 2) return arr;
    return ['Painel 1', 'Painel 2'];
  }, [selectedDoc?.equipamentos]);


  const handleMachineChange = (id: string) => {
    setFlash(true);
    navigate(`/maquina/${id}`);
    setTimeout(() => setFlash(false), 200);
  };

  
  {
    errorData && (
      <div className="text-center py-2 text-red-400 text-sm">
        {errorData}
      </div>
    )
  }


  return (
    <div
      className={`w-full h-full text-white flex bg-[#313131]
        transition-opacity duration-200
        ${flash ? "opacity-50" : "opacity-100"}`}
      key={machineId}
    >
      <SideBar />

      <BodyContent>
        <SelectExport
          selectedMachine={machineId}
          getDisplayName={id => `Pivô ${id}`}
          redirectBase="/maquina"
          onMachineChange={handleMachineChange}
          onclick_details={() => { }}
          onExport={() => { }}
          onMessage={() => setIsMensagemOpen(true)}
        />

        <Overview
          pivoId={machineId}
          cnpjCliente={cnpjCliente}
          email={user?.email}
          equipamentoNames={equipamentos}


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


        </div>

        <TensionTimeChart
          irrigadorId={machineId}
          period={selectedPeriod}
          limit={1000}
          height={400}
          equipmentNames={equipamentos}

        />
        <AlertHistory machineId={machineId} equipamentos={equipamentos} />
      </BodyContent>

      <MensagemModal
        isOpen={isMensagemOpen}
        onClose={() => setIsMensagemOpen(false)}
        selectedMachine={machineId}
      />
    </div>
  );
}