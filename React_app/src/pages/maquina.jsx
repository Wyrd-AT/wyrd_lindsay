// pages/Maquina.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SideBAr from "../components/sidebar";
import BodyContent from "../components/body";
import Header from "../components/header";
import ClientEditContainer from "../components/clientEditContainer";
import SelectExport from "../components/selectExport";
import DetalhesMaquina from "../components/detalhesMaquina";
import AlertHistory from "../components/alertHistory";
import CardText from "../components/cardText";
import { useParsedMessages } from "../hooks/useParsedMessages";
import TensaoModal from "../components/tensaoModal";
import MensagemModal from "../components/mensagemModal";
import MessageHistory from "../components/messageHistory";

export default function Maquina() {
  const { machineId } = useParams();             // ex: "01"
  const navigate = useNavigate();
  const parsed = useParsedMessages();

  // monta lista de irrigadores únicos [ "IRRIGADOR 01", "IRRIGADOR 02", ... ]
  const machines = Array.from(new Set(parsed.map((m) => m.irrigadorId))).map(
    (id) => `IRRIGADOR ${id}`
  );

  // valor inicial: se veio na URL, usa ele; senão, primeiro da lista
  const defaultMachine = machineId
    ? `IRRIGADOR ${machineId}`
    : machines[0] || "";

  const [selectedMachine, setSelectedMachine] = useState(defaultMachine);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isTensaoOpen, setIsTensaoOpen] = useState(false);
  const [isMensagemOpen, setIsMensagemOpen] = useState(false);

  // se o param mudar, atualiza o state
  useEffect(() => {
    if (machineId) {
      setSelectedMachine(`IRRIGADOR ${machineId}`);
    }
  }, [machineId]);

  // se não houver param e a lista de máquinas mudar, escolhe a primeira
  useEffect(() => {
    if (!machineId && machines.length > 0) {
      setSelectedMachine(machines[0]);
    }
  }, [machines, machineId]);

  // callback pro SelectExport: muda state e navega
  const handleMachineChange = (machine) => {
    setSelectedMachine(machine);
    const id = machine.replace("IRRIGADOR ", "");
    navigate(`/maquina/${id}`);
  };

  // alertas para exibir em CardText
  const alertHistoryData = parsed.filter(
    (msg) =>
      msg.type === "event" &&
      msg.irrigadorId === selectedMachine.replace("IRRIGADOR ", "")
  );

  return (
    <div className="w-full h-full text-white flex bg-[#313131]">
      <SideBAr />
      <BodyContent>
        <Header page="perfilClient" />
        <ClientEditContainer page="perfilClient" />

        <SelectExport
          machines={machines}
          redirectBase="/maquina"
          onclick_details={() => setIsDetailsOpen(true)}
          onClose_details={() => setIsDetailsOpen(false)}
          onMachineChange={handleMachineChange}
        />

        <DetalhesMaquina
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
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
            className="bg-blue-600 px-3 py-1 rounded hover:bg-blue-700"
          >
            Enviar Mensagem
          </button>
        </div>

        <div className="w-full flex justify-center px-6 mb-8">
          <img src="/irrigador.png" alt="Irrigador" className="w-full" />
        </div>

        <div className="flex flex-wrap px-8 justify-between">
          {alertHistoryData.length > 0 ? (
            alertHistoryData.map((alert, idx) => (
              <CardText
                key={idx}
                field={selectedMachine}
                value={
                  `Data: ${new Date(alert.datetime).toLocaleDateString()} - ` +
                  `${alert.eventType} (Código: ${alert.eventCode})`
                }
              />
            ))
          ) : (
            <p className="px-8">
              Nenhum alerta encontrado para {selectedMachine}.
            </p>
          )}
        </div>

        {/* aqui passa o selectedMachine pra filtrar no AlertHistory */}
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
        selectedMa
        chine={selectedMachine}
      />
      <MessageHistory machineId={selectedMachine} />
    </div>
  );
}
