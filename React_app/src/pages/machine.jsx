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

export default function MaquinaRevenda() {
  const navigate = useNavigate();
  const { machineId } = useParams();

  // dados dos irrigadores
  const irrigadores = useIrrigadores();
  // arrays auxiliares de IDs e labels
  const irrigadorCodes = useMemo(() => irrigadores.map(i => i.codigo), [irrigadores]);
  const irrigadorLabels = useMemo(() => irrigadores.map(i => i.irrigador), [irrigadores]);

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
  // atualiza selectedMachineId quando a rota ou dados mudam
  useEffect(() => {
    if (machineId && irrigadorCodes.includes(machineId)) {
      setSelectedMachineId(machineId);
    } else if (!machineId && irrigadorCodes.length > 0) {
      navigate(`/maquina/${irrigadorCodes[0]}`, { replace: true });
    }
  }, [machineId, irrigadorCodes, navigate]);

  // data do irrigador selecionado
  const selectedDoc = useMemo(
    () => irrigadores.find(doc => doc.codigo === selectedMachineId),
    [irrigadores, selectedMachineId]
  );

  const vectorsSW = useMemo(() => {
  return swMap[selectedMachineId]?.vectorsSW ?? []
}, [swMap, selectedMachineId])

const vectorsTensions = useMemo(() => {
  return tensionMap[selectedMachineId]?.vectorsTension?? []
}, [tensionMap, selectedMachineId])
  const equipamentos = selectedDoc?.equipamentos ?? [];

  // handler de troca de máquina
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
          getDisplayName={id => `IRRIGADOR ${id}`}
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

        {/* <AlertHistory machineId={selectedMachineId} /> */}
      </BodyContent>

      <MensagemModal
        isOpen={isMensagemOpen}
        onClose={() => setIsMensagemOpen(false)}
        selectedMachine={selectedMachineId}
      />

      {/* Caso haja necessidade de detalhes adicionais */}
      {isDetailsOpen && (
        <SyncProvider
          doc={selectedDoc}
          onClose={() => setIsDetailsOpen(false)}
        />
      )}
    </div>
  );
}
