import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

import SideBar from "../components/sidebar";
import BodyContent from "../components/body";
import Header from "../components/header";
import SelectExport from "../components/SelectExport";
import AlertHistory from "../components/alertHistory";
import MensagemModal from "../components/messageModal";
import TensaoModal from "../components/tensionModal";
import StatusAlarmModal from "../components/statusAlarmModal";
import DetalhesMaquina from "../components/machineDetails";
import StatsRow from "../components/statsRow";

import useParsedMessages from "../hooks/useParsedMessages";

// Importar os componentes inline
import StatusHistory from "../components/statusHistory";
import TensionPreview from "../components/tensionPreview";

export default function MaquinaRevenda() {
  const { clientId, machineId } = useParams();
  const navigate = useNavigate();
  const parsed = useParsedMessages();

  const machines = Array.from(new Set(parsed.map((m) => m.irrigadorId))).map(
    (id) => `IRRIGADOR ${id}`
  );

  const defaultMachine = machineId
    ? `IRRIGADOR ${machineId}`
    : machines[0] || "";

  const [selectedMachine, setSelectedMachine] = useState(defaultMachine);
  const [isTensaoOpen, setIsTensaoOpen] = useState(false);
  const [isMensagemOpen, setIsMensagemOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (machineId) {
      setSelectedMachine(`IRRIGADOR ${machineId}`);
    }
  }, [machineId]);

  useEffect(() => {
    if (!machineId && machines.length > 0) {
      setSelectedMachine(machines[0]);
    }
  }, [machines, machineId]);

  const handleMachineChange = (machine) => {
    setSelectedMachine(machine);
    const id = machine.replace("IRRIGADOR ", "");
    navigate(`/clientes/${clientId}/machines/${id}`);

    setFlash(true);
    setTimeout(() => setFlash(false), 200);
  };

  const handleExport = () => {
    console.log("Exportando dados de", selectedMachine);
  };

  return (
    <div
      className={`w-full h-full text-white flex bg-[#313131] transition-opacity duration-200 ${
        flash ? "opacity-50" : "opacity-100"
      }`}
      key={selectedMachine}
    >
      <SideBar />
      <BodyContent>
        <Header page="perfilRevenda" />

        {/* Remove onAlarm e onTension para tirar os botões */}
        <SelectExport
          machines={machines}
          redirectBase={`/clientes/${clientId}/machines`}
          onMachineChange={handleMachineChange}
          onclick_details={() => setIsDetailsOpen(true)}
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

        {/* Histórico de Alertas */}
        <AlertHistory machineId={selectedMachine} />

        <StatusHistory selectedMachine={selectedMachine} />

        {/* Preview da Tensão na parte inferior, botão abre modal */}
        <div className="mt-4">
          {/* <h3 className="font-semibold text-lg mb-2">Histórico de Tensão (Prévia)</h3> */}
          <TensionPreview selectedMachine={selectedMachine} />
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setIsTensaoOpen(true)}
              className="px-6 py-2 rounded bg-gray-600 hover:bg-gray-700"
            >
              Expandir Tensão
            </button>
          </div>
        </div>
      </BodyContent>

      {/* Modais */}
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
