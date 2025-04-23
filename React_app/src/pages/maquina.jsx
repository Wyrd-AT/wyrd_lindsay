// pages/Maquina.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SideBar from "../components/sidebar";
import BodyContent from "../components/body";
import Header from "../components/header";
import ClientEditContainer from "../components/clientEditContainer";
import SelectExport from "../components/SelectExport";
import AlertHistory from "../components/alertHistory";
import TensaoModal from "../components/TensaoModal";
import MensagemModal from "../components/MensagemModal";
import StatusAlarmModal from "../components/StatusAlarmModal";  // <–– import novo
import { useParsedMessages } from "../hooks/useParsedMessages";

export default function Maquina() {
  const { machineId } = useParams();
  const navigate = useNavigate();
  const parsed = useParsedMessages();

  const machines = Array.from(
    new Set(parsed.map((m) => m.irrigadorId))
  ).map((id) => `IRRIGADOR ${id}`);

  const defaultMachine = machineId
    ? `IRRIGADOR ${machineId}`
    : machines[0] || "";

  const [selectedMachine, setSelectedMachine] = useState(defaultMachine);
  const [isTensaoOpen, setIsTensaoOpen] = useState(false);
  const [isMensagemOpen, setIsMensagemOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);  // <–– estado novo

  useEffect(() => {
    if (machineId) setSelectedMachine(`IRRIGADOR ${machineId}`);
  }, [machineId]);

  useEffect(() => {
    if (!machineId && machines.length > 0) {
      setSelectedMachine(machines[0]);
    }
  }, [machines, machineId]);

  const handleMachineChange = (machine) => {
    setSelectedMachine(machine);
    const id = machine.replace("IRRIGADOR ", "");
    navigate(`/maquina/${id}`);
  };

  return (
    <div className="w-full h-full text-white flex bg-[#313131]">
      <SideBar />

      <BodyContent>
        <Header page="perfilClient" />
        <ClientEditContainer page="perfilClient" />

        <SelectExport
          machines={machines}
          redirectBase="/maquina"
          onMachineChange={handleMachineChange}
          onclick_details={() => {}}
        />

        <div className="flex gap-4 px-6 my-4">
          <button
            onClick={() => setIsTensaoOpen(true)}
            className="bg-green-600 px-3 py-1 rounded hover:bg-green-700"
          >
            Ver Tensão
          </button>
          <button
            onClick={() => setIsMensagemOpen(true)}
            className="bg-gray-500 px-3 py-1 rounded hover:bg-gray-600"
          >
            Enviar Mensagem
          </button>
          <button
            onClick={() => setIsStatusOpen(true)}
            className="bg-red-600 px-3 py-1 rounded hover:bg-red-700"
          >
            Status Alarme
          </button>
        </div>

        <div className="w-full flex justify-center px-6 mb-8">
          <img
            src="/irrigador.png"
            alt="Irrigador"
            className="w-full max-h-96 object-contain rounded"
          />
        </div>

        <AlertHistory machineId={selectedMachine} />
      </BodyContent>

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

      <StatusAlarmModal                        // <–– inclusão do modal
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
        selectedMachine={selectedMachine}
      />
    </div>
  );
}
