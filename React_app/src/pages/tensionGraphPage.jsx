import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useMtTensionStore } from "../stores/mtTensionStore";  // Importando o store de mtTension
import TensionGraph from "../components/TensionGraph";
import SideBar from "../components/SideBar";
import Body from "../components/Body";  // Corrigido para usar Body

export default function FullTensionGraphPage() {
  const { machineId } = useParams();  // Obtém o 'machineId' da URL
  const { initialize, tensionMessages, isLoading, error } = useMtTensionStore();  // Pegue o store de mtTension

  const [filterType, setFilterType] = useState('1h');
  const [customRange, setCustomRange] = useState({ start: null, end: null });

  const { startTime, endTime } = useMemo(() => {
    const now = Date.now();
    let start = null, end = now;

    if (filterType === '1h') start = now - 1000 * 60 * 60;
    else if (filterType === '24h') start = now - 1000 * 60 * 60 * 24;
    else if (filterType === '7d') start = now - 1000 * 60 * 60 * 24 * 7;
    else if (filterType === 'all') { start = null; end = null; }
    else if (filterType === 'custom') {
      start = customRange.start?.getTime() ?? null;
      end = customRange.end?.getTime() ?? null;
    }
    return { startTime: start, endTime: end };
  }, [filterType, customRange]);

  // Carregar os dados de 'mtTension' baseado no filtro
  useEffect(() => {
    initialize(machineId, startTime, endTime);  // Chama a função do store para inicializar e carregar os dados
  }, [machineId, startTime, endTime, initialize]);

  return (
    <div className="flex w-full h-full bg-[#313131]">
      {/* Barra lateral */}
      <SideBar />

      {/* Corpo do conteúdo */}
      <Body>
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
          {isLoading ? (
            <p className="text-white">Carregando dados de tensão...</p>
          ) : error ? (
            <p className="text-red-500">{error}</p>
          ) : (
            <TensionGraph data={tensionMessages} />
          )}
        </div>
      </Body>
    </div>
  );
}
