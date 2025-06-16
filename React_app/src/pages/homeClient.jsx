// pages/HomePageRevenda.jsx
import React, { useMemo } from "react";
import { useMessageStore } from "../stores/messageStore";
import BodyContent from "../components/body";
import Header from "../components/header";
import Sidebar from "../components/sidebar";
import SearchBar from "../components/searchbar";
import IrrigadorCard from "../components/irrigadorCard";
import SyncProgressModal from "../components/SyncProgressModal";

export default function HomePageRevenda() {
  const { parsedMessages, isLoading, error } = useMessageStore();

  // Derive a lista de IDs únicos sempre que `parsedMessages` mudar
  const machines = useMemo(
    () => {
      if (isLoading || error) return [];
      return Array.from(new Set(parsedMessages.map((m) => m.irrigadorId)));
    },
    [parsedMessages, isLoading, error]
  );

  // Data do último alerta
  const getLastAlertDate = (id) => {
    if (isLoading || error) return null;
    const events = parsedMessages
      .filter((m) => m.type === "event" && m.irrigadorId === id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (!events.length) return null;
    return new Date(events[0].timestamp).toLocaleDateString();
  };

  // Contagem de alertas
  const getAlertCount = (id) => {
    if (isLoading || error) return 0;
    return parsedMessages.filter((m) => m.type === "event" && m.irrigadorId === id)
      .length;
  };

  if (isLoading) {
    return (
      <div className="w-full h-screen text-white flex bg-[#313131]">
        <SyncProgressModal />
        <Sidebar />
        <BodyContent>
          <Header page="home" />
          <div className="flex items-center justify-center h-full">
            <div className="text-xl">Carregando irrigadores...</div>
          </div>
        </BodyContent>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen text-white flex bg-[#313131]">
        <SyncProgressModal />
        <Sidebar />
        <BodyContent>
          <Header page="home" />
          <div className="flex items-center justify-center h-full">
            <div className="text-xl text-red-500">Erro ao carregar irrigadores: {error}</div>
          </div>
        </BodyContent>
      </div>
    );
  }

  return (
    <div className="w-full h-screen text-white flex bg-[#313131]">
      <SyncProgressModal />
      <Sidebar />
      <BodyContent>
        <Header page="home" />

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
