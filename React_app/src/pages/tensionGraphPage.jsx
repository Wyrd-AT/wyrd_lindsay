// src/pages/FullTensionGraphPage.js
import React, { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useParsedMessages } from "../hooks/useParsedMessages";
import TensionGraph from "../components/tensionGraph";
import SideBar from "../components/sidebar";
import BodyContent from "../components/body";

// Mapeamento de IDs para nomes curtos
const irrigadorIdMap = {
  "111111": "1",
  "222222": "2",
  "333333": "3",
};

export default function FullTensionGraphPage() {
  const { machineId } = useParams();
  const parsed = useParsedMessages();

  const rawReadings = useMemo(() => {
    return parsed
      .filter((m) => m.type === "mtTension" && m.irrigadorId === machineId)
      .flatMap((m) =>
        (m.mtReadings || []).map((r) => ({
          mt: r.mt,
          voltage: parseFloat(r.voltage) || 0,
          timestamp: new Date(m.timestamp),
          status: r.status,
        }))
      )
      .sort((a, b) => a.mt - b.mt || a.timestamp - b.timestamp);
  }, [parsed, machineId]);

  // Nome exibido
  const displayName = irrigadorIdMap[machineId] || machineId;

  return (
    <div className="flex w-full h-full bg-[#313131]">
      <SideBar />

      <BodyContent>
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">
            Gráfico de Tensões — IRRIGADOR {displayName}
          </h1>
          <Link
            to={`/maquina/${machineId}`}
            className="px-3 py-1 bg-[#616061] rounded hover:bg-gray-700 text-white"
          >
            ← Voltar
          </Link>
        </header>

        <div className="w-full h-[600px] bg-[#222] p-4 rounded">
          <TensionGraph data={rawReadings} irrigadorId={machineId} />
        </div>
      </BodyContent>
    </div>
  );
}
