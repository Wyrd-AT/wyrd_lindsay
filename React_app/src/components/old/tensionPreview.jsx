// src/components/TensionPreview.js
import React, { useState, useMemo } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import { useParsedMessages } from "../hooks/useParsedMessages";
import { useNavigate } from "react-router-dom";  // Alterado de 'useHistory' para 'useNavigate'

export default function TensionPreview({ selectedMachine }) {
  const [isOpen, setIsOpen] = useState(false);
  const parsed = useParsedMessages();
  const navigate = useNavigate();  // Usando o hook 'useNavigate' para navegação
  const machineId = selectedMachine.replace("IRRIGADOR ", "");

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

  const mtStats = useMemo(() => {
    const now = Date.now();
    const hAgo = now - 1000 * 60 * 60;
    const dAgo = now - 1000 * 60 * 60 * 24;
    const groups = {};
    rawReadings.forEach((r) => {
      groups[r.mt] = groups[r.mt] || [];
      groups[r.mt].push(r);
    });
    const stats = [];
    for (let i = 1; i <= 12; i++) {  // Limitar a 12
      const arr = (groups[i] || []).sort((a, b) => b.timestamp - a.timestamp);
      const last = arr[0];
      const avg = (ary) =>
        ary.length
          ? (ary.reduce((s, x) => s + x.voltage, 0) / ary.length).toFixed(3)
          : "–";
      stats.push({
        mt: i,
        last: last ? last.voltage.toFixed(3) : "–",
        avgHour: avg(arr.filter((x) => x.timestamp.getTime() >= hAgo)),
        avgDay:  avg(arr.filter((x) => x.timestamp.getTime() >= dAgo)),
        status: last ? last.status : "OFF",
      });
    }
    return stats;
  }, [rawReadings]);

  const hasLowVoltage = mtStats.some(({ last, status }) => {
    const lv = parseFloat(last);
    return status === "ON" && !isNaN(lv) && lv < 50;
  });

  const handleToggle = (e) => setIsOpen(e.target.open);

  return (
    <details
      className="bg-[#222] text-white p-2 rounded shadow w-full mt-4"
      onToggle={handleToggle}
      open={isOpen}
    >
      <summary
        className={`flex items-center justify-between cursor-pointer font-semibold text-lg select-none mb-2 ${
          hasLowVoltage ? "pb-1 text-red-600" : ""
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <span>Histórico de Tensões</span>
        {isOpen ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
      </summary>

      <div className="p-4 bg-[#222] rounded-b text-white space-y-4">
        {/* Mostra os cards (MT 1–12) */}
        <div className="grid grid-cols-6 gap-6 text-center">
          {mtStats.map(({ mt, last, avgHour, avgDay, status }) => {
            const lv = parseFloat(last);
            const isLow = status === "ON" && !isNaN(lv) && lv < 50;
            return (
              <div
                key={mt}
                style={
                  isLow
                    ? { border: "2px solid #DC2626" }
                    : { border: "2px solid transparent" }
                }
                className="p-3 rounded shadow flex flex-col items-center text-sm bg-[#313131]"
              >
                <span className="font-medium mb-1">Vão {mt}</span>
                <span
                  className={`text-2xl font-semibold mb-0 ${
                    isLow ? "text-red-600" : "text-white"
                  }`}
                >
                  {last} V
                </span>
                <div className="text-xs text-gray-400 flex flex-wrap justify-center gap-0.5">
                  <span className="truncate">Média 1h: {avgHour} V</span>
                  <span className="truncate">Média 24h: {avgDay} V</span>
                </div>
                <span
                  className={`mt-2 px-2.5 py-0.5 text-xs rounded-full ${
                    status === "ON" ? "bg-green-600" : "bg-red-600"
                  }`}
                >
                  {status}
                </span>
              </div>
            );
          })}
        </div>

        {/* Botão para navegar para a página de gráfico */}
        <div className="text-right">
          <button
            onClick={() => navigate(`/maquina/${machineId}/tensao`)}  // Usando o 'navigate' para navegar
            className="px-5 py-2 bg-[#616061] text-white rounded-lg hover:bg-gray-700"
          >
            Ver gráfico de tensões
          </button>
        </div>
      </div>
    </details>
  );
}
