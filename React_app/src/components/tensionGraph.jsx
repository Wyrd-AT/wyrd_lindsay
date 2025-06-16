// src/components/TensionGraph.jsx
import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import CustomDatePicker from './customDatePicker';

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

export default function TensionGraph({ data }) {
  // MTs únicos
  const mts = useMemo(
    () => Array.from(new Set(data.map((d) => d.mt))).sort((a, b) => a - b),
    [data]
  );

  // Estados
  const [viewMode, setViewMode] = useState('mt');       // 'mt' ou 'tower'
  const [selectedMt, setSelectedMt] = useState(mts[0] || 1);
  const [selectedTower, setSelectedTower] = useState(1); // 1 => 1–8, 2 => 9–16
  const [filterType, setFilterType] = useState('1h');
  const [customRange, setCustomRange] = useState({ start: null, end: null });

  // Intervalo em ms
  const { startTime, endTime } = useMemo(() => {
    const now = Date.now();
    let start = null, end = now;
    if (filterType === '1h') start = now - 1000 * 60 * 60;
    else if (filterType === '24h') start = now - 1000 * 60 * 60 * 24;
    else if (filterType === '7d') start = now - 1000 * 60 * 60 * 24 * 7;
    else if (filterType === 'all') { start = null; end = null; }
    else if (filterType === 'custom') {
      start = customRange.start?.getTime() ?? null;
      end   = customRange.end?.getTime()   ?? null;
    }
    return { startTime: start, endTime: end };
  }, [filterType, customRange]);

  // Filtra somente por tempo
  const timeFiltered = useMemo(() =>
    data
      .filter((d) => {
        const t = d.timestamp.getTime();
        if (startTime != null && t < startTime) return false;
        if (endTime   != null && t > endTime)   return false;
        return true;
      })
      .sort((a, b) => a.timestamp - b.timestamp)
  , [data, startTime, endTime]);

  // MTs a plotar (individual ou torre)
  const mtsToPlot = useMemo(() => {
    if (viewMode === 'mt') {
      return [selectedMt];
    } else {
      const base = selectedTower === 1 ? 1 : 9;
      return Array.from({ length: 8 }, (_, i) => base + i);
    }
  }, [viewMode, selectedMt, selectedTower]);

  // Dados para o gráfico, com pontos vermelhos se y<50
  const chartData = useMemo(() => ({
    datasets: mtsToPlot.map((mt, idx) => {
      // extrai pontos desse MT
      const pts = timeFiltered
        .filter((d) => d.mt === mt)
        .map((d) => ({ x: d.timestamp, y: d.voltage }));

      // cor base e array de cores por ponto
      const baseColor = greenPalette[idx % greenPalette.length];
      const pointColors = pts.map((p) =>
        p.y < 50 ? '#ef4444' /* red-500 */ : baseColor
      );

      return {
        label: `Vão ${mt}`,
        data: pts,
        fill: false,
        borderWidth: 2,
        borderColor: baseColor,
        // cores individuais para cada ponto
        pointBackgroundColor: pointColors,
        pointBorderColor:      pointColors,
        pointRadius: 3,
        spanGaps: true,
      };
    })
  }), [timeFiltered, mtsToPlot]);

  // Opções do Chart.js
  const options = useMemo(() => ({
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: { color: '#fff', boxWidth: 12, padding: 16 },
      },
      tooltip: {
        callbacks: {
          title: (ctx) =>
            ctx[0]?.parsed?.x instanceof Date
              ? ctx[0].parsed.x.toLocaleString('pt-BR', { hour12: false })
              : ctx[0]?.label,
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} V`,
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: {
          unit:
            filterType === '1h'  ? 'minute'
          : filterType === '24h' ? 'hour'
          : filterType === '7d'  ? 'day'
          :                        'day',
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
  }), [filterType]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* CONTROLES: sem wrap e com scroll */}
      <div className="flex items-center gap-4 mb-4 overflow-x-auto whitespace-nowrap">
        {/* Modo */}
        <div>
          <label className="text-sm">Visualizar:</label>
          <select
            className="ml-2 p-1 rounded bg-[#2b2b2b] text-white"
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
          >
            <option value="mt">Vão Individual</option>
            <option value="tower">Por Torre</option>
          </select>
        </div>

        {/* MT ou Torre */}
        {viewMode === 'mt' ? (
          <div>
            <label className="text-sm">Vão:</label>
            <select
              className="ml-2 p-1 rounded bg-[#2b2b2b] text-white"
              value={selectedMt}
              onChange={(e) => setSelectedMt(Number(e.target.value))}
            >
              {mts.map((m) => (
                <option key={m} value={m}>Vão {m}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="text-sm">Torre:</label>
            <select
              className="ml-2 p-1 rounded bg-[#2b2b2b] text-white"
              value={selectedTower}
              onChange={(e) => setSelectedTower(Number(e.target.value))}
            >
              <option value={1}>T1 (MT 1–8)</option>
              <option value={2}>T2 (MT 9–16)</option>
            </select>
          </div>
        )}

        {/* Filtros fixos */}
        {['1h','24h','7d','all','custom'].map((opt) => (
          <button
            key={opt}
            onClick={() => setFilterType(opt)}
            className={`px-2 py-1 rounded text-sm transition-colors ${
              filterType === opt
                ? 'bg-green-600 text-white'
                : 'bg-[#2b2b2b] text-gray-200'
            } hover:bg-green-500`}
          >
            {opt === '1h'  ? '1h'
             : opt === '24h'? '24h'
             : opt === '7d' ? '7 dias'
             : opt === 'all'? 'Todos'
             :                 'Customizado'}
          </button>
        ))}

        {/* Customizado: Início / Fim lado a lado */}
        {filterType === 'custom' && (
          <div className="flex items-center gap-4 mb-4 whitespace-nowrap">
            <CustomDatePicker
              label="Início:"
              value={customRange.start}
              onChange={(date) =>
                setCustomRange((prev) => ({ ...prev, start: date }))
              }
            />
            <CustomDatePicker
              label="Fim:"
              value={customRange.end}
              onChange={(date) =>
                setCustomRange((prev) => ({ ...prev, end: date }))
              }
            />
          </div>
        )}
      </div>

      {/* GRÁFICO */}
      <div className="flex-1">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
