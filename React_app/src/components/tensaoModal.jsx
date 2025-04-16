// components/TensaoModal.jsx
import React, { useEffect, useState } from "react";
import { IoClose } from "react-icons/io5";
import { useParsedMessages } from "../hooks/useParsedMessages";
import TensionGraph from "./TensionGraph"; // ou use seu GraficoValores

export default function TensaoModal({ isOpen, onClose, selectedMachine }) {
  const [showGraph, setShowGraph] = useState(false);
  const parsed = useParsedMessages();

  // 1) Filtra só as mensagens de tensão da máquina
  const msgs = parsed.filter(
    (m) =>
      m.type === "mtTension" &&
      m.irrigadorId === selectedMachine.replace("IRRIGADOR ", "")
  );

  // 2) “Desenrola” cada leitura individual (supondo que cada msg.mtReadings seja array)
  const allReadings = msgs.flatMap((m) =>
    (m.mtReadings || []).map((r) => ({
      ...r,
      timestamp: m.timestamp,
    }))
  );

  // Ordena por tempo
  allReadings.sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );

  // Última tensão
  const last = allReadings[0] || null;

  // Períodos base
  const now = Date.now();
  const oneHourAgo = now - 1000 * 60 * 60;
  const oneDayAgo = now - 1000 * 60 * 60 * 24;

  // Filtra por período
  const lastHourReadings = allReadings.filter(
    (r) => new Date(r.timestamp).getTime() >= oneHourAgo
  );
  const lastDayReadings = allReadings.filter(
    (r) => new Date(r.timestamp).getTime() >= oneDayAgo
  );

  // Cálculo de média
  const avg = (arr) =>
    arr.length
      ? (arr.reduce((sum, r) => sum + parseFloat(r.voltage || 0), 0) /
          arr.length
        ).toFixed(2)
      : "–";

  const avgHour = avg(lastHourReadings);
  const avgDay = avg(lastDayReadings);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  if (!isOpen) return null;

  const backdrop = () => onClose();
  const stop = (e) => e.stopPropagation();

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      onClick={backdrop}
    >
      <div className="absolute inset-0 bg-black opacity-60" />

      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 bg-[#222] p-6 rounded-lg w-[70vw] h-[80vh] overflow-auto text-white"
        onClick={stop}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white text-2xl hover:text-gray-400"
          aria-label="Fechar"
        >
          <IoClose />
        </button>

        {!showGraph ? (
          <>
            <h2 className="text-2xl mb-4">Tensão – {selectedMachine}</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-[#1f2b36] p-4 rounded shadow">
                <p className="text-sm text-gray-400">Última Leitura</p>
                <p className="text-xl font-semibold">
                  {last ? `${last.voltage}` : "–"}
                </p>
              </div>
              <div className="bg-[#1f2b36] p-4 rounded shadow">
                <p className="text-sm text-gray-400">Média Última Hora</p>
                <p className="text-xl font-semibold">{avgHour}</p>
              </div>
              <div className="bg-[#1f2b36] p-4 rounded shadow">
                <p className="text-sm text-gray-400">Média Último Dia</p>
                <p className="text-xl font-semibold">{avgDay}</p>
              </div>
            </div>

            <button
              onClick={() => setShowGraph(true)}
              className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700"
            >
              Ver Gráfico de Tensão
            </button>
          </>
        ) : (
          <>
            <h2 className="text-2xl mb-4">Gráfico – {selectedMachine}</h2>
            <div className="bg-[#1f2b36] p-4 rounded shadow mb-4">
              <TensionGraph data={allReadings} />
              {/*
                Se preferir usar o seu GraficoValores, troque para:
                <GraficoValores selectedMachine={selectedMachine} />
              */}
            </div>
            <button
              onClick={() => setShowGraph(false)}
              className="bg-green-600 px-4 py-2 rounded hover:bg-green-700"
            >
              Voltar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
