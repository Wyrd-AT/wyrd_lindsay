import React, { useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useTensionData } from '../../hooks/new/useTensionData';
import type { Period } from '../../types/tension';
import { IoMdDownload } from 'react-icons/io';
import { IoReload } from 'react-icons/io5';

const COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300',
  '#d0ed57', '#8dd1e1', '#a4de6c', '#d08484',
  '#84d0d8', '#b584d0', '#d0b584', '#84b5d0',
  '#b5d084', '#d084b5'
];

interface TensionTimeChartProps {
  irrigadorId: string;
  period?: Period;
  limit?: number;
  width?: string | number;
  height?: string | number;
  title?: string;
  equipmentNames: string[];
}

export function TensionTimeChart({
  irrigadorId,
  period = 'last24h',
  limit = 1000,
  width = '100%',
  height = 400,
  title,
  equipmentNames,
}: TensionTimeChartProps) {

  const chartRef = useRef<HTMLDivElement>(null);

  const { points, loading, error, refresh } = useTensionData({
    irrigadorId,
    period,
    limit,
    equipmentNames,
  });

  const handleDownloadPDF = async () => {
    if (!chartRef.current) return;

    try {
      // Captura o elemento como canvas
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#222222',
        scale: 2, // Aumenta a qualidade da imagem
      });

      // Converte canvas para imagem
      const imgData = canvas.toDataURL('image/png');

      // Cria o PDF
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);

      // Gera o nome do arquivo com data e hora atual
      const fileName = `grafico_tensao_${irrigadorId}_${format(new Date(), 'dd-MM-yyyy_HH-mm-ss')}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar o PDF. Por favor, tente novamente.');
    }
  };

  // Formato final para o Recharts
  const chartData = useMemo(
    () => points.map(p => ({ timestamp: p.timestamp, ...p.values })),
    [points]
  );

  const monitorKeys = useMemo(() => {
    if (!chartData.length) return [];

    const keySet = new Set<string>();

    chartData.forEach((entry) => {
      Object.keys(entry).forEach((key) => {
        if (key === 'timestamp') return;
        const value = entry[key];
        if (typeof value === 'number') {
          keySet.add(key);
        }
      });
    });

    // Só mantém os que estão em equipmentNames (que têm nome)
    return Array.from(keySet)
      .filter((key) => equipmentNames.includes(key))
      .sort();
  }, [chartData, equipmentNames]);


  // Somente equipamentos com nome
  const visibleEquipments = equipmentNames
    .filter(n => n && n.trim() !== '')
    .map(n => n.trim());

  // Domínio Y automático
  const yDomain = useMemo(() => {
    if (!chartData.length) return [0, 100];

    let min = Infinity;
    let max = -Infinity;

    chartData.forEach(entry => {
      monitorKeys.forEach(key => {
        const v = entry[key];
        if (typeof v === 'number') {
          min = Math.min(min, v);
          max = Math.max(max, v);
        }
      });
    });

    const margin = (max - min) * 0.1;
    return [Math.floor(min - margin), Math.ceil(max + margin)];
  }, [chartData, monitorKeys]);

  if (loading) {
    return (
      <div className="flex items-center justify-center  bg-[#222222] rounded-b-lg" style={{ height }}>
        <p className="text-gray-400">Carregando dados...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ height }}>
        <p className="text-red-400">Erro ao carregar dados: {error}</p>
        <button
          onClick={refresh}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-gray-400">Nenhum dado disponível</p>
      </div>
    );
  }

  const chartTitle = title || `Tensão pelo Tempo - Irrigador ${irrigadorId}`;

  return (
    <div className=" bg-[#222222] p-6 rounded-b-lg" ref={chartRef}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-semibold text-white">{chartTitle}</h3>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadPDF}
             className="bg-gray-700 text-white text-sm font-medium px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition"
            title="Baixar o gráfico em PDF"
          >
            <IoMdDownload />
          </button>
          <button
            onClick={refresh}
            className="bg-gray-700 text-white text-sm font-medium px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition"
          >
            <IoReload />

          </button>
        </div>
      </div>

      <ResponsiveContainer width={width} height={height}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#444" />

          <XAxis
            dataKey="timestamp"
            tickFormatter={(ts) => format(new Date(ts), 'dd/MM HH:mm', { locale: ptBR })}
            stroke="#999"
            tick={{ fill: '#999' }}
          />

          <YAxis
            domain={yDomain}
            label={{
              value: 'Tensão (V)',
              angle: -90,
              position: 'insideLeft',
              style: { fill: '#999' },
            }}
            stroke="#999"
            tick={{ fill: '#999' }}
            tickFormatter={(v) => v.toFixed(1)}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: '#222222',
              border: '1px solid #444',
              borderRadius: '4px',
            }}
            labelStyle={{ color: '#fff' }}
            itemStyle={{ color: '#fff' }}
            labelFormatter={(ts) => format(new Date(ts), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
            formatter={(value: any, name: string) => [`${value.toFixed(2)} V`, name]}
          />

          <Legend wrapperStyle={{ color: '#999' }} iconType="line" />

          {monitorKeys.map((key, idx) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={key}
              stroke={COLORS[idx % COLORS.length]}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 text-sm text-gray-400">
        <p>Total de pontos: {chartData.length}</p>
        <p>Período: {period}</p>
        <p>Equipamentos: {visibleEquipments.join(', ')}</p>
      </div>
    </div>
  );
}

export default TensionTimeChart;
