// components/TensionGraph.jsx
import React from "react";
import { Line } from "react-chartjs-2";
// Lembre-se de instalar e configurar o chart.js e react-chartjs-2

export default function TensionGraph({ tensionData }) {
  const data = {
    labels: tensionData.map((reading) =>
      new Date(reading.timestamp).toLocaleTimeString()
    ),
    datasets: [
      {
        label: "Tensão",
        data: tensionData.map((reading) => reading.voltage),
        fill: false,
        borderWidth: 2,
      },
    ],
  };

  return <Line data={data} />;
}
