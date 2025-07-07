// src/pages/MaquinaRevenda.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";

import SideBar from "../components/sidebar";
import BodyContent from "../components/body";
import SelectExport from "../components/selectExport";
import StatusHistory from "../components/StatusHistory";
import AlertHistory from "../components/AlertHistory";
import MensagemModal from "../components/messageModal";

import useVetorSw from "../hooks/vetorSW";
import { useIrrigadores } from "../stores/dataStoreIrrigadores";
import SyncProvider from "../components/SyncProvider";

export default function MaquinaRevenda() {
  
  const navigate = useNavigate();
  const { machineId } = useParams();
  const irrigadoresObjs = useIrrigadores();
  // 1) extrai só os IDs (strings) dos irrigadores
  const irrigadorIds = useMemo(
    () => irrigadoresObjs.map(doc => doc.codigo),
    [irrigadoresObjs]
  );

  const irrigadorIdsSelect = useMemo(
    () => irrigadoresObjs.map(doc => doc.irrigador),
    [irrigadoresObjs]
  );


  // 2) estado local: qual irrigador está selecionado
  const [selectedMachineId, setSelectedMachineId] = useState(() => {
    return machineId && irrigadorIds.includes(machineId)
      ? machineId
      : irrigadorIds[0] || null;
  });

  // 3) sincroniza URL ⇆ estado
  useEffect(() => {
    if (machineId && irrigadorIds.includes(machineId)) {
      setSelectedMachineId(machineId);
    } else if (!machineId && irrigadorIds[0]) {
      navigate(`/maquina/${irrigadorIds[0]}`, { replace: true });
    }
  }, [machineId, irrigadorIds, navigate]);

  // 4) chama o hook uma vez, passando todos os IDs
  //    swMap = { [id]: { vectorsSW: string[], latestSW: string|null } }
  const swMap = useVetorSw(irrigadorIds);
  //console.log(swMap)

  // 5) obtém só o array de vetores SW do irrigador selecionado
  const vectorsSW = useMemo(() => {
    return swMap[selectedMachineId]?.vectorsSW ?? [];
  }, [swMap, selectedMachineId]);

  // 6) pega o objeto completo do irrigador selecionado
  const selectedDoc = useMemo(
    () => irrigadoresObjs.find(doc => doc.codigo === selectedMachineId),
    [irrigadoresObjs, selectedMachineId]
  );

  // 7) extrai o array de equipamentos (ou vazio)
  const equipamentos = selectedDoc?.equipamentos ?? [];

  // 8) troca de irrigador na UI
  const [flash, setFlash] = useState(false);
  const handleMachineChange = id => {
    setFlash(true);
    navigate(`/maquina/${id}`);
    setTimeout(() => setFlash(false), 200);
  };

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isMensagemOpen, setIsMensagemOpen] = useState(false);

  return (
    <SyncProvider>
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
          machines={irrigadorIdsSelect}
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
        />

        <AlertHistory machineId={selectedMachineId} />
      </BodyContent>

      <MensagemModal
        isOpen={isMensagemOpen}
        onClose={() => setIsMensagemOpen(false)}
        selectedMachine={selectedMachineId}
      />
    </div>
    </SyncProvider>
  );
}
