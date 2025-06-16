// src/pages/FullTensionGraphPage.js
import React, { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useParsedMessages } from "../hooks/useParsedMessages";
import TensionGraph from "../components/tensionGraph";
import SideBar from "../components/sidebar";  // Sidebar do app
import BodyContent from "../components/body";  // Corpo do conteúdo, onde o gráfico será renderizado

export default function FullTensionGraphPage() {
  const { machineId } = useParams();  // Obtém o 'machineId' da URL
  const parsed = useParsedMessages(); // Hook para obter as mensagens (dados de tensões)

  // Filtra os dados de tensão (MT) e os organiza
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

  return (
    <div className="flex w-full h-full bg-[#313131]">
      {/* Barra lateral, que é a mesma de outras páginas */}
      <SideBar />

      {/* Corpo do conteúdo */}
      <BodyContent>
        <header className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">
            Gráfico de Tensões — IRRIGADOR {machineId}
          </h1>
          <Link
            to={`/maquina/${machineId}`}  // Navega de volta à página da máquina selecionada
            className="px-3 py-1 bg-[#616061] rounded hover:bg-gray-700 text-white"
          >
            ← Voltar
          </Link>
        </header>

        {/* Gráfico de Tensão */}
        <div className="w-full h-[600px] bg-[#222] p-4 rounded">
          <TensionGraph data={rawReadings} />
        </div>
      </BodyContent>
    </div>
  );
}
