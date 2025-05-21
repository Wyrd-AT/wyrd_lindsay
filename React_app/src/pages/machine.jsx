// src/pages/machine.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SideBar from "../components/sidebar";
import BodyContent from "../components/body";
import Header from "../components/header";
import SelectExport from "../components/selectExport";
import AlertHistory from "../components/alertHistory";
import TensaoModal from "../components/tensionModal";
import MensagemModal from "../components/messageModal";
import StatusAlarmModal from "../components/statusAlarmModal";
import DetalhesMaquina from "../components/machineDetails";
import StatsRow from "../components/statsRow";
import useParsedMessages from "../hooks/useParsedMessages";

export default function Maquina() {
  const { machineId } = useParams();
  const navigate = useNavigate();
  const parsed = useParsedMessages();

  // monta lista única de irrigadores
  const machines = Array.from(new Set(parsed.map((m) => m.irrigadorId))).map(
    (id) => `IRRIGADOR ${id}`
  );

  // valor inicial
  const defaultMachine = machineId
    ? `IRRIGADOR ${machineId}`
    : machines[0] || "";

  const [selectedMachine, setSelectedMachine] = useState(defaultMachine);
  const [isTensaoOpen, setIsTensaoOpen] = useState(false);
  const [isMensagemOpen, setIsMensagemOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [flash, setFlash] = useState(false);

  // sincroniza com a URL
  useEffect(() => {
    if (machineId) {
      setSelectedMachine(`IRRIGADOR ${machineId}`);
    }
  }, [machineId]);

  // se não vier param, escolhe o primeiro
  useEffect(() => {
    if (!machineId && machines.length > 0) {
      setSelectedMachine(machines[0]);
    }
  }, [machines, machineId]);

  const handleMachineChange = (machine) => {
    setSelectedMachine(machine);
    const id = machine.replace("IRRIGADOR ", "");
    navigate(`/maquina/${id}`);

    // flash effect
    setFlash(true);
    setTimeout(() => setFlash(false), 200);
  };

  const handleExport = () => {
    // coloque aqui sua lógica de export (download CSV, etc)
    console.log("Exportando dados de", selectedMachine);
  };

  return (
    <div
      className={`
        w-full h-full text-white flex bg-[#313131]
        transition-opacity duration-200 ${
          flash ? "opacity-50" : "opacity-100"
        }
      `}
      key={selectedMachine}
    >
      <SideBar />

      <BodyContent>
        <Header page="perfilClient" />

        <SelectExport
          machines={machines}
          redirectBase="/maquina"
          onMachineChange={handleMachineChange}
          onclick_details={() => setIsDetailsOpen(true)}
          onAlarm={() => setIsStatusOpen(true)}
          onTension={() => setIsTensaoOpen(true)}
          onMessage={() => setIsMensagemOpen(true)}
          onExport={handleExport}
        />

        <div className="w-full flex justify-center px-6 mb-8">
          <img
            src="/esquematico.png"
            alt="Irrigador"
            className="w-full max-h-96 object-contain rounded"
          />
        </div>

        <StatsRow />

        {/* Agora não há mais botões aqui */}

        <AlertHistory machineId={selectedMachine} />
      </BodyContent>

      {/* Modais acionados pelos botões no SelectExport */}
      <TensaoModal
        isOpen={isTensaoOpen}
        onClose={() => setIsTensaoOpen(false)}
        selectedMachine={selectedMachine}
      />
      <MensagemModal
        isOpen={isMensagemOpen}
        onClose={() => setIsMensagemOpen(false)}
        selectedMachine={selectedMachine}
      />
      <StatusAlarmModal
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
        selectedMachine={selectedMachine}
      />
      <DetalhesMaquina
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        selectedMachine={selectedMachine}
      />
    </div>
  );
}
