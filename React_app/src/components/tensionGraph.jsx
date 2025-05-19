// components/tensionGraph.jsx
import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import 'chartjs-adapter-date-fns'; // para escala de tempo

/**
 * TensionGraph exibe leituras de tensão ao longo do tempo,
 * com filtros fixos e customizáveis.
 * Props:
 *   data: Array<{ mt: number, voltage: number, timestamp: Date }>
 */
export default function TensionGraph({ data }) {
  // Extração de MTs únicos
  const mts = useMemo(
    () => Array.from(new Set(data.map((d) => d.mt))).sort((a, b) => a - b),
    [data]
  );

  // Estados de seleção
  const [selectedMt, setSelectedMt] = useState(mts[0] || 1);
  const [filterType, setFilterType] = useState('1h'); // '1h','24h','7d','all','custom'
  const [customRange, setCustomRange] = useState({ start: '', end: '' });

  // Calcula início e fim do filtro
  const { startTime, endTime } = useMemo(() => {
    const now = Date.now();
    let start = null;
    let end = now;
    switch (filterType) {
      case '1h':
        start = now - 1000 * 60 * 60;
        break;
      case '24h':
        start = now - 1000 * 60 * 60 * 24;
        break;
      case '7d':
        start = now - 1000 * 60 * 60 * 24 * 7;
        break;
      case 'all':
        start = null;
        end = null;
        break;
      case 'custom':
        start = customRange.start ? new Date(customRange.start).getTime() : null;
        end = customRange.end ? new Date(customRange.end).getTime() : null;
        break;
      default:
        start = now - 1000 * 60 * 60;
    }
    return { startTime: start, endTime: end };
  }, [filterType, customRange]);

  // Filtra dados por MT e intervalo
  const filtered = useMemo(() => {
    return data
      .filter((d) => d.mt === selectedMt)
      .filter((d) => {
        const ts = d.timestamp.getTime();
        if (startTime != null && ts < startTime) return false;
        if (endTime != null && ts > endTime) return false;
        return true;
      })
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [data, selectedMt, startTime, endTime]);

  // Prepara dados para Chart.js (time scale)
  const chartData = useMemo(
    () => ({
      datasets: [
        {
          label: `MT ${selectedMt} (V)`,
          data: filtered.map((d) => ({ x: d.timestamp, y: d.voltage })),
          fill: false,
          borderWidth: 2,
          borderColor: '#2de76e',
          pointBackgroundColor: '#2de76e',
        },
      ],
    }),
    [filtered, selectedMt]
  );

  // Configurações do gráfico
  const options = useMemo(
    () => ({
      scales: {
        x: {
          type: 'time',
          time: {
            unit:
              filterType === '1h'
                ? 'minute'
                : filterType === '24h'
                ? 'hour'
                : filterType === '7d'
                ? 'day'
                : 'day',
            tooltipFormat: 'yyyy-MM-dd HH:mm',
          },
          title: { display: true, text: 'Horário' },
        },
        y: {
          title: { display: true, text: 'Tensão (V)' },
        },
      },
      maintainAspectRatio: false,
    }),
    [filterType]
  );

  return (
    <div className="w-full h-full flex flex-col">
      {/* Controles de seleção */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        {/* Seletor de MT */}
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

        {/* Botões de filtro fixo */}
        {['1h', '24h', '7d', 'all', 'custom'].map((opt) => (
          <button
            key={opt}
            onClick={() => setFilterType(opt)}
            className={`px-2 py-1 rounded text-sm transition-colors ${
              filterType === opt
                ? 'bg-green-600 text-white'
                : 'bg-[#2b2b2b] text-gray-200'
            } hover:bg-green-500`}
          >
            {opt === '1h'
              ? '1h'
              : opt === '24h'
              ? '24h'
              : opt === '7d'
              ? '7 dias'
              : opt === 'all'
              ? 'Todos'
              : 'Custom'}
          </button>
        ))}

        {/* Inputs para intervalo customizado */}
        {filterType === 'custom' && (
          <div className="flex items-center gap-2 bg-gray-200 p-2 rounded">
            <div>
              <label className="text-sm">Início:</label>
              <input
                type="datetime-local"
                className="ml-2 p-1 rounded bg-gray-100 text-gray-900 border border-green-500 focus:border-green-600 focus:outline-none"
                value={customRange.start}
                onChange={(e) =>
                  setCustomRange((prev) => ({ ...prev, start: e.target.value }))
                }
              />
            </div>
            <div>
              <label className="text-sm">Fim:</label>
              <input
                type="datetime-local"
                className="ml-2 p-1 rounded bg-gray-100 text-gray-900 border border-green-500 focus:border-green-600 focus:outline-none"
                value={customRange.end}
                onChange={(e) =>
                  setCustomRange((prev) => ({ ...prev, end: e.target.value }))
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* Gráfico */}
      <div className="flex-1">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
