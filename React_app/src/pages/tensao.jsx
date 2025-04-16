// pages/Tensao.jsx
import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom"; // Importa useParams
import AlertHistory from "../components/alertHistory";
import BodyContent from "../components/body";
import ClientEditContainer from "../components/clientEditContainer";
import DetalhesMaquina from "../components/detalhesMaquina";
import Header from "../components/header";
import SelectExport from "../components/selectExport";
import SideBAr from "../components/sidebar";
import { useParsedMessages } from "../hooks/useParsedMessages";
import GraficoValores from "../components/graficoValores";

export default function Tensao() {
  // Extrai machineId (identificador do irrigador) da URL
  const { machineId } = useParams();

  // Estado do irrigador selecionado – inicializa com o parâmetro da URL, se existir
  const [selectedMachine, setSelectedMachine] = useState(machineId || "");
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const parsedMessages = useParsedMessages();

  // Gere a lista de irrigadores únicos a partir dos dados
  const machinesSet = new Set(parsedMessages.map((msg) => msg.irrigadorId));
  const machines = Array.from(machinesSet);

  // Se não houver irrigador selecionado (ou seja, machineId vazio) e houver dados, escolha o primeiro
  useEffect(() => {
    if (!selectedMachine && machines.length > 0) {
      setSelectedMachine(machines[0]);
    }
  }, [machines, selectedMachine]);

  // Atualiza selectedMachine se o parâmetro da URL mudar
  useEffect(() => {
    if (machineId) {
      setSelectedMachine(machineId);
    }
  }, [machineId]);

  // Filtra as mensagens de tensão para o irrigador selecionado
  const tensionMessages = parsedMessages.filter(
    (msg) =>
      msg.type === "mtTension" && msg.irrigadorId === selectedMachine
  );

  // Agrupa para obter a última leitura do irrigador selecionado
  const latestTensionsByIrrigador = tensionMessages.reduce((acc, msg) => {
    const id = msg.irrigadorId;
    if (!acc[id] || (msg.timestamp && new Date(msg.timestamp) > new Date(acc[id].timestamp))) {
      acc[id] = msg;
    }
    return acc;
  }, {});
  const latestTensionList = Object.values(latestTensionsByIrrigador);

  return (
    <div className="w-full h-full text-white flex bg-[#313131]">
      <SideBAr />
      <BodyContent>
        <div className="w-full">
          <Header page="tensao" />
          <ClientEditContainer page="tensao" />
          {/* 
            Passa o redirectBase, a lista de máquinas e a callback.
            Se o usuário mudar a seleção, o SelectExport redirecionará para `/tensao/<novoID>`
          */}
          <SelectExport
            onclick_details={() => setIsDetailsOpen(true)}
            onClose_details={() => setIsDetailsOpen(false)}
            onMachineChange={(machine) => setSelectedMachine(machine)}
            machines={machines}
            redirectBase="/tensao"
          />
          <DetalhesMaquina
            isOpen={isDetailsOpen}
            onClose={() => setIsDetailsOpen(false)}
          />
          <div className="w-full flex justify-center px-6 mb-8">
            <img
              src="/irrigador.png"
              alt="Irrigador"
              className="w-full max-w-3xl"
            />
          </div>
          <div className="px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {latestTensionList.length > 0 ? (
              latestTensionList.map((tension) => (
                <div
                  key={tension.irrigadorId}
                  className="bg-[#1f2b36] rounded-lg p-4 shadow-md"
                >
                  <h2 className="text-xl font-semibold mb-3">
                    Irrigador {tension.irrigadorId}
                  </h2>
                  {tension.mtReadings.map((reading) => (
                    <div key={reading.mt} className="mb-2">
                      <div className="text-sm text-gray-200 font-semibold">
                        MT {reading.mt}:
                      </div>
                      <div className="text-md text-gray-100">
                        {reading.voltage || "undefined"}{" "}
                        <span className="text-sm">
                          ({reading.status || "undefined"})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <p className="col-span-full text-center text-gray-200">
                Nenhuma leitura de tensão encontrada para {selectedMachine}.
              </p>
            )}
          </div>
          <div className="mt-8 px-8">
            <h2 className="text-xl font-semibold mb-4">
              Gráfico do Dia para {selectedMachine}
            </h2>
            <div className="bg-[#1f2b36] rounded-lg p-4 shadow-md">
              <GraficoValores />
            </div>
          </div>
        </div>
        <AlertHistory />
      </BodyContent>
    </div>
  );
}
