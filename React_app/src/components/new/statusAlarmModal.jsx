// src/components/StatusAlarmModal.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { IoClose } from "react-icons/io5";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import useMessageStore from "../../stores/new/messageStore";
import { useIrrigadores } from "../../stores/new/dataStoreIrrigadores";
import { sendCommand } from "../../helpers/helperOverview";
import { selectCanToggleAlarm, useAuthStore } from "../../stores/new/authStore";

// Mapeamento dos códigos para a descrição
const valueDescriptions = {
  0: "Normal",
  1: "Alarmado",
  2: "Reconhecido",
  3: "Alarme OFF",
  9: "Ausente",
};
const alarmTypeDescriptions = {
  A: "Tensão abaixo de 50V e PN1 (Lindsay) e PN2 (SFR)",
  B: "Fim-de-curso 1 (SW1)",
  C: "Fim-de-curso 2 (SW2)",
  D: "Memória de Tensão baixa (1 a 8)",
  E: "Torre ausente (não responde à Central)",
};

export default function StatusAlarmModal({
  isOpen,
  onClose,
  selectedMachine,
  card, // { title, statuses }
}) {
  const postMessage = useMessageStore((s) => s.postMessage);

  const [loading, setLoading] = useState(false);
  const [responseMsg, setResponseMsg] = useState("");
  const [collapsedSections, setCollapsedSections] = useState({});

  const canToggleAlarm = useAuthStore(selectCanToggleAlarm);

  // Fecha modal com Esc
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const machineId = selectedMachine?.replace("IRRIGADOR ", "") || "";
  const equipment = card?.title || "";

  // Puxa lista de irrigadores e monta mapeamento código→equipamento
  const irrigadores = useIrrigadores() || [];
  const irrigador_analisado = useMemo(
    () => irrigadores.find((i) => i.codigo === machineId),
    [irrigadores, machineId],
  );
  const equipamento_by_code = useMemo(() => {
    if (!irrigador_analisado) return {};
    return Object.fromEntries(
      Array.from({ length: 13 }, (_, i) => {
        const code = String(i + 1).padStart(2, "0"); // "01".."13"
        const idx = i + 2; // posições 2..14 em equipamentos[]
        return [code, irrigador_analisado.equipamentos[idx]];
      }),
    );
  }, [irrigador_analisado]);

  // Descobre qual o código de monitor deste equipamento
  const monitorCode = useMemo(() => {
    const found = Object.entries(equipamento_by_code).find(
      ([code, nome]) => nome === equipment,
    );
    return found ? found[0] : "";
  }, [equipamento_by_code, equipment]);

  if (!isOpen || !card) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black opacity-60" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 bg-[#222] text-white p-6 rounded-lg w-full max-w-[50vw] max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botão de fechar */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-white text-2xl hover:text-gray-400"
          aria-label="Fechar"
        >
          <IoClose />
        </button>

        {/* Título */}
        <h2 className="text-2xl font-semibold mb-4 text-center">
          Histórico – {equipment}
        </h2>

        {/* Status atuais do card */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {card.statuses.map((s) => {
            const isTension = s.label === "Falha por tensão";
            const desc = isTension
              ? s.value
              : valueDescriptions[s.value] || s.value;
            return (
              <div
                key={s.label}
                className="bg-[#2b2b2b] p-2 rounded flex flex-col"
              >
                <span className="font-medium">{s.label}</span>
                <span className="mt-1">{desc}</span>
              </div>
            );
          })}
        </div>

        {/* Botões de ação */}
        <div className="flex gap-2 mb-4">
          {canToggleAlarm && (
            <button
              type="button"
              onClick={() =>
                sendCommand(
                  `AlarmeON${monitorCode}`,
                  "Alarme ligado com sucesso!",
                  "Falha ao ligar alarme.",
                  machineId,
                  setResponseMsg,
                  setLoading,
                )
              }
              disabled={loading || !monitorCode}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-2 rounded"
            >
              {loading ? "..." : "Ligar Alarme"}
            </button>
          )}
          {canToggleAlarm && (
            <button
              type="button"
              onClick={() =>
                sendCommand(
                  `AlarmeOFF${monitorCode}`,
                  "Alarme desligado com sucesso!",
                  "falha ao desligar alarme.",
                  machineId,
                  setResponseMsg,
                  setLoading,
                  loading,
                )
              }
              disabled={loading || !monitorCode}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 rounded"
            >
              {loading ? "..." : "Desligar Alarme"}
            </button>
          )}
        </div>

        {responseMsg && (
          <p
            className={`mb-4 ${
              responseMsg.startsWith("✅") ? "text-green-400" : "text-red-400"
            }`}
          >
            {responseMsg}
          </p>
        )}

        {/* Histórico de alertas por equipamento */}
      </div>
    </div>
  );
}
