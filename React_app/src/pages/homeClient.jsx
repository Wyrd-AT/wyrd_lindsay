import React, { useMemo, useEffect } from "react";
import { useMessageStore } from "../stores/messageStore";
import BodyContent from "../components/body";
import Header from "../components/header";
import Sidebar from "../components/sidebar";
import SearchBar from "../components/searchbar";
import IrrigadorCard from "../components/irrigadorCard";
import SyncProgressModal from "../components/SyncProgressModal";

export default function HomePageRevenda() {
  const { parsedMessages, isLoading, error } = useMessageStore();

  useEffect(() => {
    // Ensure messages are loaded when the home page is opened
    useMessageStore.getState().initialize();
  }, []);

  console.log('[homeClient] render', { isLoading, error, parsedMessagesLength: parsedMessages.length });

  // Mapeamento de IDs para exibição
  const irrigadorIdMap = {
    "111111": "1",
    "222222": "2",
    "333333": "3",
  };

  const getMachineDisplayName = (id) => irrigadorIdMap[id] || id;

  // Lista de irrigadores únicos com IDs reais
  const machines = useMemo(() => {
    if (isLoading || error) return [];
    const result = Array.from(
      new Set(
        parsedMessages
          .map((m) => m.irrigadorId)
          .filter((id) => typeof id === "string" && id.trim() !== "")
      )
    );
    console.log('[homeClient] machines', result);
    return result;
  }, [parsedMessages, isLoading, error]);

  // Última data de alerta por ID
  const getLastAlertDate = (id) => {
    if (isLoading || error) return null;
    const events = parsedMessages
      .filter((m) => m.type === "event" && m.irrigadorId === id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (!events.length) return null;
    return new Date(events[0].timestamp).toLocaleDateString();
  };

  // Total de alertas por ID
  const getAlertCount = (id) => {
    if (isLoading || error) return 0;
    return parsedMessages.filter((m) => m.type === "event" && m.irrigadorId === id).length;
  };

  // Carregando...
  if (isLoading) {
    console.log('[homeClient] isLoading true, showing loading UI');
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

  // Erro ao carregar
  if (error) {
    console.log('[homeClient] error, showing error UI', error);
    return (
      <div className="w-full h-screen text-white flex bg-[#313131]">
        <SyncProgressModal />
        <Sidebar />
        <BodyContent>
          <Header page="home" />
          <div className="flex items-center justify-center h-full">
            <div className="text-xl text-red-500">
              Erro ao carregar irrigadores: {error}
            </div>
          </div>
        </BodyContent>
      </div>
    );
  }

  // Interface principal
  console.log('[homeClient] showing main UI', machines);
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
            [...machines]
            .sort((a, b) => getAlertCount(b) - getAlertCount(a)) // 🔁 ordena do maior para o menor
            .map((id) => (
              <IrrigadorCard
                key={id}
                machineId={id}
                displayName={`IRRIGADOR ${getMachineDisplayName(id)}`}
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
