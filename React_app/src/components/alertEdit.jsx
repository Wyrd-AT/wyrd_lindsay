// src/components/AlertEdit.jsx
import React, { useEffect, useState, useRef } from "react";
import { IoClose } from "react-icons/io5";
import { FiShare2 } from "react-icons/fi";
import { alarmTypeDescriptions, valueDescriptions } from "./alertHistory";
import useLatestAlertasPorMonitor from "../hooks/useLatestAlertasPorMonitor";
import useHistoricoAlertasStore from "../hooks/alertsHistoryStore";
import { readData, saveData } from "../api/database_app";

function formatInterval(mins) {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const horaLabel = `HORA${h > 1 ? "S" : ""}`;
    const minLabel = m > 0 ? ` ${m} MINUTO${m > 1 ? "S" : ""}` : "";
    return `${h} ${horaLabel}${minLabel}`;
  }
  return `${mins} MINUTO${mins > 1 ? "S" : ""}`;
}

export default function AlertEdit({ isOpen, onClose, alertData }) {
  const [description, setDescription] = useState("");
  const [responsible, setResponsible] = useState("");
  const [alarmInterval, setAlarmInterval] = useState(0);
  const [timer, setTimer] = useState(0);
  const modalRef = useRef(null);

  const { latestAlertas } = useLatestAlertasPorMonitor();
  const latestForMonitor = latestAlertas.find(
    (a) =>
      a.monitor === alertData?.monitor &&
      a.date !== alertData?.date &&
      a.irrigadorId == alertData?.irrigadorId
  );

  const { update: updateHistory } = useHistoricoAlertasStore();

  useEffect(() => {
    if (!isOpen || !alertData) return;

    // 1) Descrição
    setDescription(
      alertData.description ??
        alarmTypeDescriptions[alertData.alarme] ??
        ""
    );

    const hasResponsible =
      alertData.responsible != null && alertData.responsible !== "";
    const hasTimer = alertData.timer != null;

    if (hasResponsible && hasTimer) {
      // 2) Já vem no próprio alertData
      setResponsible(alertData.responsible);
      setTimer(alertData.timer);
      setAlarmInterval(alertData.timer);
    } else if (alertData._id) {
      // 3) Busca no localDB se faltar algo
      readData({ _id: alertData._id })
        .then((docs) => {
          const doc = docs[0];
          if (doc) {
            const resp = doc.responsible ?? "";
            const tim = doc.timer ?? 0;

            setResponsible(resp);
            setTimer(tim);
            setAlarmInterval(tim);

            // Persiste só se não vinha antes
            if (!hasResponsible || !hasTimer) {
              updateHistory(alertData._id, {
                responsible: resp,
                timer: tim,
              })
                .then(() =>
                  console.log(
                    "✅ timer e responsible persistidos no histórico"
                  )
                )
                .catch((err) =>
                  console.error(
                    "❌ Falha ao persistir timer/responsible:",
                    err
                  )
                );
            }
          } else {
            console.warn(
              "⚠️ Nenhum documento encontrado com _id:",
              alertData._id
            );
          }
        })
        .catch((err) =>
          console.error("❌ Erro ao ler documento pelo _id:", err)
        );
    } else {
      // 4) Nem alertData.timer nem _id: zera tudo
      setResponsible("");
      setTimer(0);
      setAlarmInterval(0);
    }

    // Foca no textarea
    setTimeout(() => modalRef.current?.focus(), 0);
  }, [isOpen, alertData?._id]);

  // Fecha com Esc
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () =>
      window.removeEventListener("keydown", handleKeyDown);
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

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      // 1) Monta o documento completo
      const updatedDoc = {
        description,
        responsible,
        timer,
        _id: alertData._id,
        _rev: alertData._rev, // caso você controle revisões manualmente
      };

      // 2) Grava no local, replica no remoto e retorna id+rev definitivos
      const { id, rev } = await saveData(updatedDoc);
      console.log(`✅ Gravado e replicado no CouchDB com rev ${rev}`);

      // Atualiza o _rev em alertData para futuros updates
      alertData._rev = rev;

      // 3) Atualiza também o histórico local (Zustand)
      await updateHistory(alertData._id, {
        description,
        responsible,
        timer,
      });
      console.log(
        "✅ Documento atualizado com timer, responsável e descrição (histórico local)"
      );
    } catch (err) {
      console.error("❌ Falha ao atualizar:", err);
    }

    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
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
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
            >
              <IoClose size={20} />
            </button>
          </div>
        </div>

        {/* Infos básicas em 4 colunas */}
        <div className="grid grid-cols-4 gap-4 p-4">
          <div>
            <label className="block text-xs text-gray-400">ID</label>
            <div className="break-all text-sm">{alertData._id}</div>
          </div>
          <div>
            <label className="block text-xs text-gray-400">Data</label>
            <div className="text-sm">{alertData.date}</div>
          </div>
          <div>
            <label className="block text-xs text-gray-400">Hora</label>
            <div className="text-sm">{alertData.time}</div>
          </div>
          <div>
            <label className="block text-xs text-gray-400">Status</label>
            <div className="text-sm">
              {valueDescriptions[alertData.status]}
            </div>
          </div>
        </div>

        {/* Intervalo genérico */}
        <div className="p-4 border-t border-[#444]">
          <h3 className="text-xs text-gray-400">
            Ativar alarme novamente em:
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="number"
              min={0}
              value={alarmInterval}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                const v = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
                setAlarmInterval(v);
                setTimer(v);
              }}
              className="w-20 px-2 py-1 text-sm bg-[#444444] rounded"
            />
            <span className="text-sm text-gray-300">
              {formatInterval(alarmInterval)}
            </span>
          </div>
        </div>

        {/* Descrição */}
        <div className="p-4">
          <label className="block mb-1 text-xs text-gray-400">
            Descrição
          </label>
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

        {/* Botões */}
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
