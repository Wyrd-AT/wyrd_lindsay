// components/tensionModal.jsx
import React, { useEffect, useState, useMemo } from "react";
import { IoClose } from "react-icons/io5";
import { useParsedMessages } from "../hooks/useParsedMessages";
import TensionGraph from "./TensionGraph";

export default function TensaoModal({ isOpen, onClose, selectedMachine }) {
  const parsed = useParsedMessages();
  const machineId = selectedMachine.replace("IRRIGADOR ", "");
  const [showGraph, setShowGraph] = useState(false);

  // Reset view ao abrir ou trocar máquina
  useEffect(() => {
    if (isOpen) setShowGraph(false);
  }, [isOpen, machineId]);

  // Raw readings para o gráfico
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

  // Estatísticas para cada MT
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
    for (let i = 1; i <= 18; i++) {
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

  // Fecha com ESC
  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black opacity-60" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 bg-[#222] p-6 rounded-lg w-[80vw] h-[80vh] overflow-auto text-white flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white text-2xl hover:text-gray-400"
        >
          <IoClose />
        </button>

        <h2 className="text-2xl mb-4 text-center">
          Tensão – {selectedMachine}
        </h2>

        {!showGraph ? (
          <>
            {/* Grid de cards para cada MT */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 flex-1">
              {mtStats.map(({ mt, last, avgHour, avgDay, status }) => (
                <div
                  key={mt}
                  className="bg-[#2b2b2b] p-6 rounded shadow flex flex-col items-center"
                >
                  <span className="font-medium mb-1">MT {mt}</span>
                  <span className="text-2xl font-semibold mb-1">
                    {last} V
                  </span>
                  <div className="text-xs text-gray-400 text-center">
                    <div>Média 1h: {avgHour} V</div>
                    <div>Média 24h: {avgDay} V</div>
                  </div>
                  <span
                    className={`mt-2 px-2.5 py-0.5 text-xs rounded-full ${
                      status === "ON" ? "bg-green-600" : "bg-red-600"
                    }`}
                  >
                    {status}
                  </span>
                </div>
              ))}
            </div>

            {/* Botão para exibir o gráfico */}
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setShowGraph(true)}
                className="px-6 py-2 rounded bg-green-600 hover:bg-green-700"
              >
                Visualizar Gráfico
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col">
            {/* Gráfico de todos os MTs ou apenas tempo? Aqui todos */}
            <div className="flex-1">
              <TensionGraph data={rawReadings} />
            </div>
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setShowGraph(false)}
                className="px-6 py-2 rounded bg-green-600 hover:bg-green-700"
              >
                Voltar aos Cards
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
