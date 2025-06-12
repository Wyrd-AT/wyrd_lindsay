import { createContext, useMemo } from "react";
import { useParsedMessages } from "../hooks/useParsedMessages";
import BodyContent from "../components/body";
import Header from "../components/header";
import Sidebar from "../components/sidebar";
import SearchBar from "../components/searchbar";
import IrrigadorCard from "../components/irrigadorCard";
import { useState } from "react";

export const SearchContext = createContext(null);

export default function HomePageRevenda() {
  const [searchTerm, setSearchTerm] = useState("");

  const parsed = useParsedMessages();

  // Derive a lista de IDs únicos sempre que `parsed` mudar
  const machines = useMemo(
    () => Array.from(new Set(parsed.map((m) => m.irrigadorId))),
    [parsed],
  );

  const filteredMachines = machines.filter((item) =>
    item.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Data do último alerta
  const getLastAlertDate = (id) => {
    const events = parsed
      .filter((m) => m.type === "event" && m.irrigadorId === id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (!events.length) return null;
    return new Date(events[0].timestamp).toLocaleDateString();
  };

  // Contagem de alertas
  const getAlertCount = (id) =>
    parsed.filter((m) => m.type === "event" && m.irrigadorId === id).length;

  return (
    <SearchContext.Provider value={{ searchTerm, setSearchTerm }}>
      <div className="w-full h-screen text-white flex bg-[#313131]">
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
            {filteredMachines.length > 0 ? (
              filteredMachines.map((id) => (
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
    </SearchContext.Provider>
  );
}
