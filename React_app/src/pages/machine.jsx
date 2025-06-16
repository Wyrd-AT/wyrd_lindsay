import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";

import SideBar from "../components/sidebar";
import BodyContent from "../components/body";
import Header from "../components/header";
import SelectExport from "../components/selectExport";
import AlertHistory from "../components/alertHistory";
import MensagemModal from "../components/messageModal";
import TensaoModal from "../components/tensionModal";

import useParsedMessages from "../hooks/useParsedMessages";

import StatusHistory from "../components/statusHistory";
import TensionPreview from "../components/tensionPreview";

export default function MaquinaRevenda() {
  const { clientId, machineId } = useParams();
  const navigate = useNavigate();
  const parsed = useParsedMessages();

  // Mapeamento de IDs → nomes curtos
  const irrigadorIdMap = {
    "111111": "1",
    "222222": "2",
    "333333": "3",
  };

  const getDisplayName = (id) => `IRRIGADOR ${irrigadorIdMap[id] || id}`;

  // Lista de IDs reais únicos
  const machineIds = useMemo(() => {
    return Array.from(new Set(parsed.map((m) => m.irrigadorId)));
  }, [parsed]);

  // Estado: ID real selecionado (ex: "111111")
  const [selectedMachineId, setSelectedMachineId] = useState(machineId || machineIds[0] || "");
  const [isTensaoOpen, setIsTensaoOpen] = useState(false);
  const [isMensagemOpen, setIsMensagemOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [flash, setFlash] = useState(false);

  // Atualiza selectedMachineId quando a URL muda
  useEffect(() => {
    if (machineId) {
      setSelectedMachineId(machineId);
    } else if (machineIds.length > 0) {
      setSelectedMachineId(machineIds[0]);
    }
  }, [machineId, machineIds]);

  // Quando usuário muda o irrigador
  const handleMachineChange = (id) => {
    setSelectedMachineId(id);
    navigate(`/maquina/${id}`);
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
  };

  const handleExport = () => {
    console.log("Exportando dados de", selectedMachineId);
  };

  return (
    <div
      className={`w-full h-full text-white flex bg-[#313131] transition-opacity duration-200 ${
        flash ? "opacity-50" : "opacity-100"
      }`}
      key={selectedMachineId}
    >
      <SideBar />
      <BodyContent>
        <SelectExport
          machines={machineIds} // passa os IDs reais
          getDisplayName={getDisplayName} // passa função de nome formatado
          redirectBase={`/maquina`}
          onMachineChange={handleMachineChange}
          onclick_details={() => setIsDetailsOpen(true)}
          onMessage={() => setIsMensagemOpen(true)}
          onExport={handleExport}
        />

        <StatusHistory selectedMachine={selectedMachineId} />
        <AlertHistory machineId={selectedMachineId} />
        <TensionPreview
          selectedMachine={selectedMachineId}
          onExpand={() => setIsTensaoOpen(true)}
        />
      </BodyContent>

      {/* Modais */}
      <TensaoModal
        isOpen={isTensaoOpen}
        onClose={() => setIsTensaoOpen(false)}
        selectedMachine={selectedMachineId}
      />
      <MensagemModal
        isOpen={isMensagemOpen}
        onClose={() => setIsMensagemOpen(false)}
        selectedMachine={selectedMachineId}
      />
    </div>
  );
}
