import React, { useState, useMemo } from "react";
import {
  FiZap,
  FiChevronDown,
  FiChevronUp,
  FiMaximize2,
} from "react-icons/fi";
import { useParsedMessages } from "../hooks/useParsedMessages";
import SimpleTensionGraph from "./simpleTensionGraph";

export default function TensionPreview({ selectedMachine, onExpand }) {
  const [isOpen, setIsOpen] = useState(false);
  const parsed = useParsedMessages();
  const machineId = selectedMachine.replace("IRRIGADOR ", "");

  // monta rawReadings igual antes…
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

  // estatísticas dos primeiros 8 MTs (preview)
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
    for (let i = 1; i <= 16; i++) {
      const arr = (groups[i] || []).sort(
        (a, b) => b.timestamp - a.timestamp
      );
      const last = arr[0];
      const avg = (ary) =>
        ary.length
          ? (ary.reduce((s, x) => s + x.voltage, 0) / ary.length).toFixed(3)
          : "–";
      stats.push({
        mt: i,
        last: last ? last.voltage.toFixed(3) : "–",
        avgHour: avg(arr.filter((x) => x.timestamp.getTime() >= hAgo)),
        avgDay: avg(arr.filter((x) => x.timestamp.getTime() >= dAgo)),
        status: last ? last.status : "OFF",
      });
    }
    return stats;
  }, [rawReadings]);

  const handleToggle = (e) => setIsOpen(e.target.open);

  return (
    <details
      className="bg-[#222] text-white p-2 rounded shadow w-full mt-4"
      onToggle={handleToggle}
      open={isOpen}
    >
      <summary
        className="flex items-center justify-between cursor-pointer font-semibold text-lg select-none mb-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center">
          <FiZap size={20} className="mr-2" />
          Histórico de Tensões
        </div>
        {isOpen ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
      </summary>

      <div className="relative flex gap-12 p-4 bg-[#222] rounded-b text-white">
        {/* cards preview (MT 1–8) */}
        <div className="w-1/2 grid grid-cols-4 gap-6 text-center">
          {mtStats.slice(0, 8).map(({ mt, last, avgHour, avgDay, status }) => {
            const lv = parseFloat(last);
            const isLow = status === "ON" && !isNaN(lv) && lv < 50;
            return (
              <div
                key={mt}
                className="p-3 rounded shadow flex flex-col items-center text-sm bg-[#313131]"
              >
                <span className="font-medium mb-1">MT {mt}</span>
                <span
                  className={`text-2xl font-semibold mb-0 ${
                    isLow ? "text-red-600" : "text-white"
                  }`}
                >
                  {last}&nbsp;V
                </span>
                <div className="text-xs text-gray-400 flex flex-wrap justify-center gap-0.5">
                  <span className="inline-block truncate">
                    Média 1h: {avgHour} V
                  </span>
                  <span className="inline-block truncate">
                    Média 24h: {avgDay} V
                  </span>
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

        {/* gráfico simplificado */}
        <div className="w-1/2 h-64">
          <SimpleTensionGraph data={rawReadings} />
        </div>

        {/* expandir canto inferior direito */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          className="absolute bottom-4 right-4 p-2 bg-gray-700 rounded-full hover:bg-gray-600"
        >
          <FiMaximize2 size={20} />
        </button>
      </div>
    </details>
  );
}
