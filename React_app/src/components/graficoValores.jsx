// components/GraficoValores.jsx
import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

// Registrar os componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

export default function GraficoValores() {
  // Exemplo de dados "mock" para demonstração
  // No seu caso, você pode gerar esses dados dinamicamente
  const chartData = {
    labels: ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"],
    datasets: [
      {
        label: "MT 1",
        data: [220.5, 221, 219.8, 222, 218.5, 219.3],
        borderColor: "#42AE10",
        backgroundColor: "rgba(66, 174, 16, 0.2)",
        tension: 0.2, // Deixa a linha mais suave
      },
      {
        label: "MT 2",
        data: [117.2, 115, 118.9, 119.2, 120.1, 119],
        borderColor: "#E83838",
        backgroundColor: "rgba(232, 56, 56, 0.2)",
        tension: 0.2,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    scales: {
      y: {
        beginAtZero: false,
      },
    },
  };

  return (
    <div className="w-full">
      <Line data={chartData} options={chartOptions} />
    </div>
  );
}
