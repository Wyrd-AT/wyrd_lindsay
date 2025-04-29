// pages/ClientMachinesPage.jsx

import React, { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import Sidebar from "../components/sidebar";
import BodyContent from "../components/body";
import Header from "../components/header";
import SearchBar from "../components/searchbar";
import { useParsedMessages } from "../hooks/useParsedMessages";
import IrrigadorCard from "../components/irrigadorCard";

export default function ClientMachinesPage() {
  const { clientId } = useParams();
  const parsed = useParsedMessages();

  // Mesmo mapeamento de prefixos usado em pageClients.jsx
  const clientMap = {
    '0': '01','1': '01',
    '2': '23','3': '23',
    '4': '45','5': '45',
    '6': '67','7': '67',
    '8': '89','9': '89',
    'A': 'AB','B': 'AB',
    'C': 'CD','D': 'CD',
    'E': 'EF','F': 'EF'
  };

  // Lista de máquinas apenas deste cliente
  const machines = useMemo(() => {
    const ids = Array.from(new Set(parsed.map((m) => m.irrigadorId)));
    return ids.filter((id) => {
      const prefix = id.charAt(0).toUpperCase();
      const tag = clientMap[prefix] || "Outros";
      return tag === clientId;
    });
  }, [parsed, clientId]);

  const getLastAlertDate = (id) => {
    const events = parsed
      .filter((m) => m.type === "event" && m.irrigadorId === id)
      .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
    if (!events.length) return null;
    return new Date(events[0].datetime).toLocaleDateString();
  };

  const getAlertCount = (id) =>
    parsed.filter((m) => m.type === "event" && m.irrigadorId === id).length;

  return (
    <div className="w-full h-screen text-white flex bg-[#313131]">
      <Sidebar />
      <BodyContent>
        <Header page="clientes" />
        <h1 className="text-2xl mb-4">Irrigadores do Cliente {clientId}</h1>
        <div className="
          flex flex-wrap p-4 justify-around
          max-h-[80vh] overflow-auto
          scrollbar scrollbar-thin scrollbar-thumb-red-500 scrollbar-track-gray-800
        ">
          {machines.length > 0 ? (
            machines.map((id) => (
              <IrrigadorCard
                key={id}
                machineId={id}
                lastAlertDate={getLastAlertDate(id)}
                alertCount={getAlertCount(id)}
              />
            ))
          ) : (
            <p className="text-gray-300">
              Nenhum irrigador encontrado para este cliente.
            </p>
          )}
        </div>
        <div className="mt-4">
          <Link to="/clientes" className="text-blue-500 underline">
            ← Voltar aos Clientes
          </Link>
        </div>
      </BodyContent>
      <SearchBar />
    </div>
  );
}
