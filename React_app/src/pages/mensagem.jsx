// pages/Mensagem.jsx
import React, { useState } from "react";
import AlertHistory from "../components/alertHistory";
import BodyContent from "../components/body";
import ClientEditContainer from "../components/clientEditContainer";
import DetalhesMaquina from "../components/detalhesMaquina";
import Header from "../components/header";
import SelectExport from "../components/selectExport";
import SideBAr from "../components/sidebar";

export default function Mensagem() {
  const [selectedMachine, setSelectedMachine] = useState("IRRIGADOR 01");
  const [comando, setComando] = useState("");
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const handleEnviar = (e) => {
    e.preventDefault();
    console.log(`Enviando comando: "${comando}" para ${selectedMachine}`);
    // Aqui integre com o dbStore.postData() ou com o envio via MQTT, etc.
    setComando("");
  };

  return (
    <div className="w-full h-full text-white flex bg-[#313131]">
      <SideBAr />
      <BodyContent>
        <div className="w-full">
          <Header page="mensagem" />
          <ClientEditContainer page="mensagem" />
          <SelectExport
            onclick_details={() => setIsDetailsOpen(true)}
            onClose_details={() => setIsDetailsOpen(false)}
            onMachineChange={(machine) => setSelectedMachine(machine)}
          />
          <DetalhesMaquina
            isOpen={isDetailsOpen}
            onClose={() => setIsDetailsOpen(false)}
          />
          <div className="w-full flex justify-center px-6 mb-8">
            <img
              src="/irrigador.png"
              alt="Diagrama"
              className="w-full"
            />
          </div>
          <div className="px-8">
            <h2 className="text-xl font-semibold mb-4">
              Enviar Comando para {selectedMachine}
            </h2>
            <form onSubmit={handleEnviar} className="flex gap-2 items-center">
              <input
                type="text"
                value={comando}
                onChange={(e) => setComando(e.target.value)}
                className="px-2 py-1 text-black"
                placeholder="Ex: alarme, reset..."
                required
              />
              <button
                type="submit"
                className="bg-blue-600 px-3 py-1 rounded hover:bg-blue-700"
              >
                Enviar
              </button>
            </form>
          </div>
        </div>
        {/* Você pode, se desejar, incluir um histórico de comandos */}
        <AlertHistory />
      </BodyContent>
    </div>
  );
}
