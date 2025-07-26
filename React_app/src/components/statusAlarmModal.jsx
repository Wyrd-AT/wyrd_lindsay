// src/components/StatusAlarmModal.jsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { IoClose } from "react-icons/io5";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import useMessageStore from "../stores/messageStore";
import useHistoricoAlertasStore from "../hooks/alertsHistoryStore";
import { useIrrigadores } from "../stores/dataStoreIrrigadores";

// Mapeamento dos códigos para a descrição
const valueDescriptions = {
  "0": "Normal",
  "1": "Alarmado",
  "2": "Reconhecido",
  "3": "Alarme OFF",
  "9": "Ausente"
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
  card // { title, statuses }
}) {
  const postMessage = useMessageStore((s) => s.postMessage);

  // Dados já processados e formatados (date: "dd/mm/yyyy", time: "HH:mm:ss")
  const {
    data: historicoAlertas,
    isLoading: isLoadingHistory,
    error: historyError,
    update: updateHistory,
  } = useHistoricoAlertasStore();

  const [loading, setLoading] = useState(false);
  const [responseMsg, setResponseMsg] = useState("");
  const [collapsedSections, setCollapsedSections] = useState({});

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
    [irrigadores, machineId]
  );
  const equipamento_by_code = useMemo(() => {
    if (!irrigador_analisado) return {};
    return Object.fromEntries(
      Array.from({ length: 13 }, (_, i) => {
        const code = String(i + 1).padStart(2, "0"); // "01".."13"
        const idx = i + 2; // posições 2..14 em equipamentos[]
        return [code, irrigador_analisado.equipamentos[idx]];
      })
    );
  }, [irrigador_analisado]);

  // Descobre qual o código de monitor deste equipamento
  const monitorCode = useMemo(() => {
    const found = Object.entries(equipamento_by_code).find(
      ([code, nome]) => nome === equipment
    );
    return found ? found[0] : "";
  }, [equipamento_by_code, equipment]);

  // Filtra histórico só deste irrigador e equipamento
  const filteredHistory = useMemo(() => {
    if (!machineId || !equipment) return [];
    return historicoAlertas.filter((item) => {
      if (item.irrigadorId !== machineId) return false;
      const mon = String(item.monitor).padStart(2, "0");
      const equipamentoDoItem =
        mon === "17"
          ? "Painel 1"
          : mon === "18"
          ? "Painel 2"
          : equipamento_by_code[mon];
      return equipamentoDoItem === equipment;
    });
  }, [historicoAlertas, machineId, equipment, equipamento_by_code]);

  // Ordena descrescente pela combinação de date + time
  const sortedHistory = useMemo(() => {
    const parseTimestamp = ({ date, time }) => {
      const [d, m, y] = date.split("/").map(Number);
      const [hh, mm, ss] = time.split(":").map(Number);
      return new Date(y, m - 1, d, hh, mm, ss).getTime();
    };
    return [...filteredHistory].sort(
      (a, b) => parseTimestamp(b) - parseTimestamp(a)
    );
  }, [filteredHistory]);

  // Agrupa por date ("dd/mm/yyyy")
  const groupedByDate = useMemo(() => {
    return sortedHistory.reduce((acc, item) => {
      (acc[item.date] = acc[item.date] || []).push(item);
      return acc;
    }, {});
  }, [sortedHistory]);

  const toggleSection = (date) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [date]: !prev[date],
    }));
  };

  // Envio genérico de comando MQTT
  const sendCommand = useCallback(
    async (command, successText) => {
      setLoading(true);
      setResponseMsg("");
      try {
        await postMessage({
          topic: `lindsay/comandos/${machineId}`,
          payload: `${machineId};${command}`,
          origin: "app",
          table: "command",
          qos: 0,
          timestamp: new Date().toISOString(),
        });
        setResponseMsg(`✅ ${successText}`);
      } catch {
        setResponseMsg(`❌ Falha ao ${successText.toLowerCase()}.`);
      } finally {
        setLoading(false);
      }
    },
    [machineId, postMessage]
  );

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
          <button
            type="button"
            onClick={() =>
              sendCommand(
                `AlarmeON${monitorCode}`,
                "Alarme ligado com sucesso!"
              )
            }
            disabled={loading || !monitorCode}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-2 rounded"
          >
            {loading ? "..." : "Ligar Alarme"}
          </button>
          <button
            type="button"
            onClick={() =>
              sendCommand(
                `AlarmeOFF${monitorCode}`,
                "Alarme desligado com sucesso!"
              )
            }
            disabled={loading || !monitorCode}
            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 px-4 py-2 rounded"
          >
            {loading ? "..." : "Desligar Alarme"}
          </button>
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
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Histórico de Alertas</h3>
          <div className="flex justify-between px-4 py-1 hover:bg-[#2a2a2a] rounded font-medium">
            <span className="w-1/5">Hora</span>
            <span className="w-1/5">Descrição</span>
            <span className="w-1/5">Monitor</span>
            <span className="w-1/5">Status</span>
          </div>

          {isLoadingHistory ? (
            <p>Carregando histórico...</p>
          ) : historyError ? (
            <p className="text-red-400">Erro: {historyError.message}</p>
          ) : sortedHistory.length === 0 ? (
            <p>Nenhum alerta registrado ainda.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedByDate).map(([date, items]) => {
                const collapsed = collapsedSections[date];
                return (
                  <div key={date}>
                    <div
                      className="flex items-center cursor-pointer bg-[#333] px-3 py-1 rounded"
                      onClick={() => toggleSection(date)}
                    >
                      {collapsed ? <FiChevronDown /> : <FiChevronUp />}
                      <span className="ml-2 font-medium">{date}</span>
                    </div>
                    {!collapsed && (
                      <div className="mt-2">
                        {items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between px-4 py-1 hover:bg-[#2a2a2a] rounded"
                          >
                            <span className="w-1/5">{item.time}</span>
                            <span className="w-1/5">
                              {alarmTypeDescriptions[item.alarme]}
                            </span>
                            <span className="w-1/5">{item.monitor}</span>
                            <span className="w-1/5">
                              {valueDescriptions[item.status] || item.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
