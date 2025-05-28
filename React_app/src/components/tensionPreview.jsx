import React, { useMemo } from "react";
import { useParsedMessages } from "../hooks/useParsedMessages";
import TensionGraph from "./TensionGraph";

export default function TensionPreview({ selectedMachine }) {
  const parsed = useParsedMessages();
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
    for (let i = 1; i <= 16; i++) {
      const arr = (groups[i] || []).sort((a, b) => b.timestamp - a.timestamp);
      const last = arr[0];
      const avgCalc = (ary) =>
        ary.length
          ? (ary.reduce((sum, x) => sum + x.voltage, 0) / ary.length).toFixed(3)
          : "–";
      stats.push({
        mt: i,
        last: last ? last.voltage.toFixed(3) : "–",
        avgHour: avgCalc(arr.filter((x) => x.timestamp.getTime() >= hAgo)),
        avgDay: avgCalc(arr.filter((x) => x.timestamp.getTime() >= dAgo)),
        status: last ? last.status : "OFF",
      });
    }
    return stats;
  }, [rawReadings]);

  return (
    <div className="flex gap-8 p-4 bg-[#2b2b2b] rounded shadow text-white mt-4">
      {/* Cards: 60% */}
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
                <span className="inline-block whitespace-nowrap truncate">
                  Média 1h: {avgHour} V
                </span>
                <span className="inline-block whitespace-nowrap truncate">
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

      {/* Gráfico: 40% */}
      <div className="w-1/2 h-64">
        <TensionGraph data={rawReadings} />
      </div>
    </div>
  );
}
