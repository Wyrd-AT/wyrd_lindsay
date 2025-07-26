import React, { useEffect, useState, useRef } from "react";
import { IoClose } from "react-icons/io5";
import { FiShare2 } from "react-icons/fi";
import { alarmTypeDescriptions, valueDescriptions } from "./alertHistory";
import useLatestAlertasPorMonitor from "../hooks/useLatestAlertasPorMonitor";

import { whatsappStoreConfig } from "../stores/whatsappStore";

export default function AlertEdit({ isOpen, onClose, alertData, onSave }) {
  const [description, setDescription] = useState("");
  const [responsible, setResponsible] = useState("");
  const [alarmInterval, setAlarmInterval] = useState(15); // 15 minutos por padrão
  const [timer, setTimer] = useState(0); // Timer state
  const [isTimerRunning, setIsTimerRunning] = useState(false); // Timer status
  const [whatsappStatus, setWhatsappStatus] = useState(false);

  const modalRef = useRef(null);
  // Whatsapp
  const { whatsappConfig, fetchWhatsappConfig, updateWhatsappStatus } =
    whatsappStoreConfig((state) => state);
  //
  useEffect(() => {
    if (!whatsappConfig) {
      fetchWhatsappConfig();
    }
  }, [whatsappConfig, fetchWhatsappConfig]);

  const handleToggleChange = (e) => {
    const newSatus = e.target.checked;
    setWhatsappStatus(newSatus);
  };

  // Pega o último alerta para esse monitor (exceto este)
  const { latestAlertas } = useLatestAlertasPorMonitor();
  console.log(" Alertas:", alertData);

  console.log("Latest Alertas:", latestAlertas);
  const latestForMonitor = latestAlertas.find(
    (a) =>
      a.monitor === alertData?.monitor &&
      a.date !== alertData?.date &&
      a.irrigadorId == alertData?.irrigadorId,
  );

  console.log(latestForMonitor);

  // Inicializa campos ao abrir
  useEffect(() => {
    if (isOpen && alertData) {
      setDescription(
        alertData.description ?? alarmTypeDescriptions[alertData.alarme] ?? "",
      );
      fetchWhatsappConfig();
      setWhatsappStatus(whatsappConfig.status);
      setResponsible(alertData.responsible || "");
      setTimeout(() => modalRef.current?.focus(), 0);
    }
  }, [isOpen, alertData]);

  // Fecha no ESC
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !alertData) return null;

  const dt = new Date(alertData.date);
  const dateStr = dt.toLocaleDateString("pt-BR");
  const timeStr = dt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  function handleShare() {
    const text = `Alerta ${alertData.id} em ${dateStr} ${timeStr}\nStatus: ${valueDescriptions[alertData.status]}`;
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      alert("Texto do alerta copiado para a área de transferência");
    }
  }

  function handleSubmit(e) {
    e.preventDefault();

    updateWhatsappStatus(whatsappStatus);

    // Passa os dados atualizados (incluindo o timer e responsável) para a função onSave
    onSave?.({
      ...alertData, // Dados do alerta existente
      description, // Descrição atual
      responsible, // Responsável atual
      timer, // Valor atual do timer
    });

    onClose(); // Fecha o modal após salvar
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black opacity-25" />

      <form
        role="dialog"
        aria-modal="true"
        className="relative bg-[#2f2f2f] text-white rounded-md w-full max-w-md flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[#444]">
          <h2 className="text-lg font-semibold">Alerta {alertData.id}</h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleShare}
              aria-label="Compartilhar"
            >
              <FiShare2 size={20} />
            </button>
            <button type="button" onClick={onClose} aria-label="Fechar">
              <IoClose size={20} />
            </button>
          </div>
        </div>

        {/* Infos básicas em 4 colunas */}
        <div className="">
          {/* Data */}
          <div className="grid grid-cols-4 gap-4 p-4">
            <div>
              <label className="block text-xs text-gray-400">Data</label>
              <div>{dateStr}</div>
            </div>
            {/* Hora */}
            <div>
              <label className="block text-xs text-gray-400">Hora</label>
              <div>{timeStr}</div>
            </div>
            {/* Status atual */}
            <div>
              <label className="block text-xs text-gray-400">Status</label>
              <div>{valueDescriptions[alertData.status]}</div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#444]">
          <h3 className="text-xs text-gray-400">Ativar alarme novamente em:</h3>
          <select
            value={alarmInterval}
            onChange={(e) => setAlarmInterval(Number(e.target.value))}
            className="px-2 py-1 text-sm bg-[#444444] rounded"
          >
            <option value={15}>15 MINUTOS</option>
            <option value={30}>30 MINUTOS</option>
            <option value={60}>1 HORA</option>
            <option value={120}>2 HORAS</option>
          </select>
        </div>

        <div className="p-4 border-[#444]">
          <input
            type="checkbox"
            checked={whatsappStatus}
            onChange={handleToggleChange}
            className="p-4"
          />
          <label className="ml-2 text-gray-400">Notificar pelo Whatsapp</label>
        </div>

        {/* Descrição */}
        <div className="p-4">
          <label className="block mb-1 text-xs text-gray-400">Descrição</label>
          <textarea
            ref={modalRef}
            className="w-full rounded-md bg-[#444444] p-2 text-sm resize-none"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={alarmTypeDescriptions[alertData.alarme]}
          />
        </div>

        {/* Responsável */}
        <div className="p-4">
          <label className="block mb-1 text-xs text-gray-400">
            Responsável
          </label>
          <input
            type="text"
            className="w-full rounded-md bg-[#444444] p-2 text-sm"
            value={responsible}
            onChange={(e) => setResponsible(e.target.value)}
            placeholder="Nome do responsável"
          />
        </div>

        {/* Botões de ação */}
        <div className="flex justify-end gap-2 p-4 border-t border-[#444]">
          <button
            type="button"
            className="px-4 py-2 border rounded text-sm"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-green-600 rounded text-sm"
          >
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}
