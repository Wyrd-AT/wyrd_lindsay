// src/pages/ClienteMaquinaPage.jsx
import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import SideBar from "../components/sidebar";
import BodyContent from "../components/body";
import Header from "../components/header";
import ClientEditContainer from "../components/clientEditContainer";
import SelectExport from "../components/selectExport";
import AlertHistory from "../components/alertHistory";
import TensaoModal from "../components/TensaoModal";
import MensagemModal from "../components/MensagemModal";
import StatusAlarmModal from "../components/StatusAlarmModal";
import { useParsedMessages } from "../hooks/useParsedMessages";
import { FiChevronLeft } from "react-icons/fi";

export default function ClienteMaquinaPage() {
  const { clientTag, machineId } = useParams();
  const navigate = useNavigate();
  const parsed = useParsedMessages();

  // Mapeia prefixos para cada cliente
  const clientMap = {
    "01": ["0","1"],
    "23": ["2","3"],
    "45": ["4","5"],
    "67": ["6","7"],
    "89": ["8","9"],
    EF: ["A","B","C","D","E","F"],
  };

  // Lista só dos irrigadores deste cliente
  const allIds = Array.from(new Set(parsed.map(m => m.irrigadorId)));
  const myMachines = allIds.filter(id =>
    (clientMap[clientTag] || []).includes(id.charAt(0).toUpperCase())
  );

  // Estado de seleção + flash
  const [selectedMachine, setSelectedMachine] = useState(machineId || myMachines[0] || "");
  const [isTensaoOpen, setIsTensaoOpen] = useState(false);
  const [isMensagemOpen, setIsMensagemOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen]     = useState(false);
  const [flash, setFlash]                   = useState(false);

  // Sincroniza URL → state
  useEffect(() => {
    if (machineId) setSelectedMachine(machineId);
  }, [machineId]);

  // Dropdown → navega e dá flash
  const handleMachineChange = (full) => {
    const id = full.replace("IRRIGADOR ", "");
    setSelectedMachine(id);
    setFlash(true);
    setTimeout(() => setFlash(false), 50);
    navigate(`/clientes/${clientTag}/maquina/${id}`);
  };

  return (
    <div
      className={`
        w-full h-full text-white flex
        bg-[#313131] transition-colors duration-300
        ${flash ? "bg-white bg-opacity-20" : ""}
      `}
    >
      <SideBar />

      <BodyContent>
        {/* Botão de voltar para detalhes do cliente */}
        <div className="flex items-center gap-2 mb-4">
          <Link to={`/clientes/${clientTag}`} className="text-white hover:text-gray-300">
            <FiChevronLeft size={20} /> Voltar
          </Link>
        </div>

        <Header page="perfilClient" />
        <ClientEditContainer page="perfilClient" />

        <SelectExport
          machines={myMachines.map(i => `IRRIGADOR ${i}`)}
          redirectBase={`/clientes/${clientTag}/maquina`}
          onMachineChange={handleMachineChange}
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

        <AlertHistory machineId={`IRRIGADOR ${selectedMachine}`} />
      </BodyContent>

      <TensaoModal
        isOpen={isTensaoOpen}
        onClose={() => setIsTensaoOpen(false)}
        selectedMachine={`IRRIGADOR ${selectedMachine}`}
      />

      <MensagemModal
        isOpen={isMensagemOpen}
        onClose={() => setIsMensagemOpen(false)}
        selectedMachine={`IRRIGADOR ${selectedMachine}`}
      />

      <StatusAlarmModal
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
        selectedMachine={`IRRIGADOR ${selectedMachine}`}
      />
    </div>
  );
}
