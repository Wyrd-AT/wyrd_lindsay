// components/TensionGraph.jsx
import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';

/**
 * TensionGraph exibe leituras de tensão ao longo do tempo.
 * Props:
 *   data: array de { mt: number, voltage: number, timestamp: Date }
 */
export default function TensionGraph({ data }) {
  // Extrai MTs únicos
  const mts = useMemo(
    () => Array.from(new Set(data.map((d) => d.mt))).sort((a, b) => a - b),
    [data]
  );
  const [selectedMt, setSelectedMt] = useState(mts[0] || 1);
  const [timeRange, setTimeRange] = useState('1h');

  // Filtra pelo MT e intervalo
  const filtered = useMemo(() => {
    const now = Date.now();
    let cutoff = null;
    if (timeRange === '1h') cutoff = now - 1000 * 60 * 60;
    if (timeRange === '24h') cutoff = now - 1000 * 60 * 60 * 24;

    return data
      .filter(
        (d) =>
          d.mt === selectedMt &&
          (cutoff === null || d.timestamp.getTime() >= cutoff)
      )
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [data, selectedMt, timeRange]);

  // Prepara os dados do Chart.js
  const chartData = useMemo(() => ({
    labels: filtered.map((d) => d.timestamp.toLocaleTimeString()),
    datasets: [
      {
        label: `MT ${selectedMt} (V)`,
        data: filtered.map((d) => d.voltage),
        fill: false,
        borderWidth: 2,
        borderColor: '#2de76e', 
        pointBackgroundColor: '#2de76e', 
      },
    ],
  }), [filtered, selectedMt]);

  const options = useMemo(() => ({
    scales: {
      x: {
        title: { display: true, text: 'Horário' },
      },
      y: {
        title: { display: true, text: 'Tensão (V)' },
      },
    },
    maintainAspectRatio: false,
  }), []);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div>
          <label className="text-sm">Selecionar MT:</label>
          <select
            className="ml-2 p-1 rounded bg-[#2b2b2b] text-white"
            value={selectedMt}
            onChange={(e) => setSelectedMt(Number(e.target.value))}
          >
            {mts.map((mt) => (
              <option key={mt} value={mt}>
                MT {mt}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm">Intervalo:</span>
          {['1h', '24h', 'all'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2 py-1 rounded text-sm transition-colors 
                ${timeRange === range ? 'bg-green-600 text-white' : 'bg-[#2b2b2b] text-gray-200'}
                hover:bg-green-500`
              }
            >
              {range === '1h' ? '1h' : range === '24h' ? '24h' : 'Todos'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
