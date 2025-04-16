// pages/HomePageRevenda.jsx
import React, { useEffect, useState } from "react";
import { useParsedMessages } from "../hooks/useParsedMessages";
import BodyContent from "../components/body";
import Header from "../components/header";
import Sidebar from "../components/sidebar";
import SearchBar from "../components/searchbar";
import IrrigadorCard from "../components/irrigadorCard";

export default function HomePageRevenda() {
  const parsed = useParsedMessages();
  const [machines, setMachines] = useState([]);

  useEffect(() => {
    // Agrupa IDs únicos
    const ids = Array.from(new Set(parsed.map((m) => m.irrigadorId)));
    setMachines(ids);
  }, [parsed]);

  // Função auxiliar para data do último alerta
  const getLastAlertDate = (id) => {
    const events = parsed
      .filter((m) => m.type === "event" && m.irrigadorId === id)
      .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
    if (!events.length) return null;
    return new Date(events[0].datetime).toLocaleDateString();
  };

  const getAlertCount = (id) =>
    parsed.filter((m) => m.type === "event" && m.irrigadorId === id)
      .length;

  return (
    <div className="w-full h-screen text-white flex bg-[#313131]">
      <Sidebar />

      <BodyContent>
        <Header page="" />

        <div
          className="
            flex flex-wrap p-4 justify-around 
            max-h-[80vh] overflow-auto 
            scrollbar scrollbar-thin scrollbar-thumb-red-500 scrollbar-track-gray-800
          "
        >
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
            <p className="text-gray-300">Nenhum irrigador encontrado.</p>
          )}
        </div>
      </BodyContent>

      <SearchBar />
    </div>
  );
}
