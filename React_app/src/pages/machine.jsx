// src/pages/MaquinaRevenda.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";

import SideBar from "../components/sidebar";
import BodyContent from "../components/body";
import SelectExport from "../components/selectExport";
import StatusHistory from "../components/StatusHistory";
import AlertHistory from "../components/alertHistory";
import MensagemModal from "../components/messageModal";
import SyncProvider from "../components/SyncProvider";

import useVetorSw from "../hooks/vetorSW";
import useVetorTension from "../hooks/VetorTension";
import { useIrrigadores } from "../stores/dataStoreIrrigadores";
import TensionChart from "../components/TensionChart";

const periodOptions = [
  { value: 'last24h', label: '24 h' },
  { value: 'last7d', label: '7 dias' },
  { value: 'last30d', label: '30 dias' },
];

export default function MaquinaRevenda() {
  const navigate = useNavigate();
  const { machineId } = useParams();

  // dados dos irrigadores
  const irrigadores = useIrrigadores();
  const irrigadorCodes = useMemo(() => irrigadores.map(i => i.codigo), [irrigadores]);
  const irrigadorLabels = useMemo(() => irrigadores.map(i => i.nome), [irrigadores]);

  // estado de máquina selecionada
  const [selectedMachineId, setSelectedMachineId] = useState(() => {
    return machineId && irrigadorCodes.includes(machineId)
      ? machineId
      : irrigadorCodes[0] || null;
  });

  // flash de transição
  const [flash, setFlash] = useState(false);

  // modais
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isMensagemOpen, setIsMensagemOpen] = useState(false);

  // sincronização e hooks de dados
  const swMap = useVetorSw(irrigadorCodes);
  const tensionMap = useVetorTension(irrigadorCodes);

  const [selectedPeriod, setSelectedPeriod] = useState('last24h');

  const currentLabel = periodOptions.find(opt => opt.value === selectedPeriod)?.label;


  useEffect(() => {
    if (machineId && irrigadorCodes.includes(machineId)) {
      setSelectedMachineId(machineId);
    } else if (!machineId && irrigadorCodes.length > 0) {
      navigate(`/maquina/${irrigadorCodes[0]}`, { replace: true });
    }
  }, [machineId, irrigadorCodes, navigate]);

  const selectedDoc = useMemo(
    () => irrigadores.find(doc => doc.codigo === selectedMachineId),
    [irrigadores, selectedMachineId]
  );

  const vectorsSW = useMemo(() => swMap[selectedMachineId]?.vectorsSW ?? [], [swMap, selectedMachineId]);
  const vectorsTensions = useMemo(() => tensionMap[selectedMachineId]?.vectorsTension ?? [], [tensionMap, selectedMachineId]);

  const equipamentos = selectedDoc?.equipamentos ?? [];

  const handleMachineChange = id => {
    setFlash(true);
    navigate(`/maquina/${id}`);
    setTimeout(() => setFlash(false), 200);
  };

  return (
    <div
      className={`
        w-full h-full text-white flex bg-[#313131]
        transition-opacity duration-200
        ${flash ? "opacity-50" : "opacity-100"}
      `}
      key={selectedMachineId}
    >
      <SideBar />

      <BodyContent>
        <SelectExport
          machines={irrigadorLabels}
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

        {/* GRID DE GRÁFICOS DE TENSÃO */}
        <div className="flex justify-start align-middle items-center mt-4 py-4 px-2 bg-[#222222] rounded-lg">
          <label htmlFor="periodSelect" className="mr-2 text-white">Período:</label>
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

        {/* Título dinâmico */}
        <h3 className="text-start py-4 px-2  bg-[#222222] text-white">Histórico de tensões de {currentLabel}</h3>

        {/* Gráfico dinâmico */}
        <TensionChart
          irrigadorId={selectedMachineId}
          period={selectedPeriod}
          height={400}
          equipments={equipamentos}
        />


        <AlertHistory  machineId={selectedMachineId} />
      </BodyContent>

      <MensagemModal
        isOpen={isMensagemOpen}
        onClose={() => setIsMensagemOpen(false)}
        selectedMachine={selectedMachineId}
      />

      {isDetailsOpen && (
        <SyncProvider
          doc={selectedDoc}
          onClose={() => setIsDetailsOpen(false)}
        />
      )}
    </div>
  );
}
