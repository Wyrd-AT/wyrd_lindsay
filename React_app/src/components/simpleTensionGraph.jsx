import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';

/** Paleta de verdes do Tailwind: green-200 a green-900 */
const greenPalette = [
  '#5aec8d',
  '#2DE76E', // verde-base
  '#21AE5A', // -20%
  '#157748',
  '#14B8A6', // teal-500
  '#0D9488', // teal-600
  '#64748B', // slate-500
  '#334155', // slate-700
];

export default function SimpleTensionGraph({ data }) {
  // Mapeia MTs disponíveis
  const mts = useMemo(
    () => Array.from(new Set(data.map((d) => d.mt))).sort((a, b) => a - b),
    [data]
  );
  const [selectedMt, setSelectedMt] = useState(mts[0] || 1);

  // fixa janela de 24 h atrás até agora
  const { startTime, endTime } = useMemo(() => {
    const now = Date.now();
    return { startTime: now - 1000 * 60 * 60 * 24, endTime: now };
  }, []);

  // filtra só este MT e últimas 24h
  const pts = useMemo(() => {
    return data
      .filter((d) => {
        const t = d.timestamp.getTime();
        return (
          d.mt === selectedMt &&
          t >= startTime &&
          t <= endTime
        );
      })
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((d) => ({ x: d.timestamp, y: d.voltage }));
  }, [data, selectedMt, startTime, endTime]);

  // monta dataset do Chart.js
  const chartData = useMemo(
    () => ({
      datasets: [
        {
          label: `MT ${selectedMt}`,
          data: pts,
          fill: false,
          borderColor: greenPalette[1],
          borderWidth: 2,
          spanGaps: true,
          pointBackgroundColor: pts.map((p) =>
            p.y < 50 ? '#ef4444' /* red-500 */ : greenPalette[1]
          ),
          pointBorderColor: pts.map((p) =>
            p.y < 50 ? '#ef4444' : greenPalette[1]
          ),
          pointRadius: 3,
        },
      ],
    }),
    [pts]
  );

  const options = useMemo(
    () => ({
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (ctx) =>
              ctx[0]?.parsed?.x instanceof Date
                ? ctx[0].parsed.x.toLocaleString('pt-BR', {
                    hour12: false,
                  })
                : ctx[0]?.label,
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} V`,
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'hour',
            tooltipFormat: 'yyyy-MM-dd HH:mm',
          },
          title: { display: true, text: 'Horário', color: '#fff' },
          ticks: { color: '#fff' },
        },
        y: {
          title: { display: true, text: 'Tensão (V)', color: '#fff' },
          ticks: { color: '#fff' },
        },
      },
      maintainAspectRatio: false,
    }),
    []
  );

  return (
    <div className="w-full h-full flex flex-col">
      <div className="mb-2">
        <label className="text-sm mr-2">MT:</label>
        <select
          value={selectedMt}
          onChange={(e) => setSelectedMt(Number(e.target.value))}
          className="p-1 rounded bg-[#2b2b2b] text-white"
        >
          {mts.map((m) => (
            <option key={m} value={m}>
              MT {m}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
