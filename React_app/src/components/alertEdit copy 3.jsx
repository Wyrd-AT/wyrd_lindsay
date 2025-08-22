// src/components/AlertEdit.jsx
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { IoClose } from "react-icons/io5";
import { FiShare2 } from "react-icons/fi";
import { alarmTypeDescriptions, valueDescriptions } from "./alertHistory";
import useLatestAlertasPorMonitor from "../hooks/useLatestAlertasPorMonitor";
import useHistoricoAlertasStore from "../hooks/alertsHistoryStore";
import { readData, saveData } from "../api/database_app";
import useMessageStore from "../stores/messageStore";
import { whatsappStoreConfig } from "../stores/whatsappStore";
import { useAuthStore } from "../stores/authStore";
import useTimer from "../hooks/useTimer";
import { useDataStoreTimers, useSpecificTimer } from "../stores/dataStoreTimers";


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
  //console.log(alertData);



  const [description, setDescription] = useState("");
  const [responsible, setResponsible] = useState("");
  const [alarmInterval, setAlarmInterval] = useState(0);
  const [ultimoAgendamento, setUltimoAgendamento] = useState("");
  const [loading, setLoading] = useState(false);
  const [responseMsg, setResponseMsg] = useState("");
  const [whatsappStatus, setWhatsappStatus] = useState(false);
  const [responsavelAgendamento, setResponsavelAgendamento] = useState("");
  const [timer, setTimer] = useState(null);
  const addTimer = useDataStoreTimers((state) => state.addTimer);
  const removeTimer = useDataStoreTimers((state) => state.removeTimer);

  // Chama o hook diretamente no topo, fora do useMemo
  const timer_id = useSpecificTimer(alertData?._id);  // Chama o hook corretamente
  console.log(timer_id)
  // Memoriza o timer encontrado (usando useMemo apenas para evitar recalcular)
  const memoizedTimer = useMemo(() => {
    return timer_id;  // Memoriza o valor retornado por useSpecificTimer
  }, [alertData, timer_id]);  // Recalcula apenas quando timer_id mudar

  useEffect(() => {
    if (memoizedTimer) {
      setTimer(memoizedTimer);  // Atualiza o estado com o timer encontrado
      console.log('Timer encontrado:', memoizedTimer);
    } else {
      console.log('Timer não encontrado');
    }
  }, [memoizedTimer]); // O efeito dispara quando memoizedTimer mudar



  const { whatsappConfig, fetchWhatsappConfig, updateWhatsappStatus } =
    whatsappStoreConfig((state) => state);
  //

  const { isAuthenticated, user, name } = useAuthStore();

  //console.log(user)

  useEffect(() => {
    if (!whatsappConfig) {
      fetchWhatsappConfig();
    }
  }, [whatsappConfig, fetchWhatsappConfig]);

  const handleToggleChange = (e) => {
    const newSatus = e.target.checked;
    setWhatsappStatus(newSatus);
  };


  const postMessage = useMessageStore((s) => s.postMessage);
  const machineId = alertData?.irrigadorId;

  const modalRef = useRef(null);

  const { latestAlertas } = useLatestAlertasPorMonitor();
  const latestForMonitor = latestAlertas.find(
    (a) =>
      a.monitor === alertData?.monitor &&
      a.date !== alertData?.date &&
      a.irrigadorId == alertData?.irrigadorId
  );

  const { update: updateHistory } = useHistoricoAlertasStore();

  const sendCommand = useCallback(
    async (command, successText, timer) => {
      setLoading(true);
      setResponseMsg("");
      try {
        await postMessage({
          topic: `lindsay/comandos/${machineId}`,
          payload: `${machineId};${command}`,
          origin: "app",
          table: "command",
          qos: 0,
          "timer": timer,
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
    const text = `Alerta ${alertData.id} em ${dateStr} ${timeStr}\nStatus: ${valueDescriptions[alertData.status]
      }`;
    if (navigator.share) {
      navigator.share({ text }).catch(() => { });
    } else {
      navigator.clipboard.writeText(text);
      alert("Texto do alerta copiado para a área de transferência");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    updateWhatsappStatus(whatsappStatus);

    try {
      // 1) Monta o documento completo
      const updatedDoc = {
        description,
        responsible,
        timer,
        _id: alertData._id,
        _rev: alertData._rev,
      };

      // 2) Grava no local, replica no remoto e retorna id+rev definitivos
      const { rev } = await saveData(updatedDoc);
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


  async function handleAgendamentoClick() {
    if (!memoizedTimer || !alertData) return;

    const agendamentoData = new Date().toLocaleString("pt-BR");
    console.log("Agendamento:", agendamentoData);
    console.log("memoizedTimer",memoizedTimer)

    try {
      const updatedDoc = {
        id_origem: alertData._id,
        ultimo_agendamento: agendamentoData,
        responsavel_agendamento: user?.email || "Desconhecido",
        timer,
      };

      console.log("Atualizando agendamento:", updatedDoc);

      // 1) Tente remover o timer antigo
      await removeTimer(memoizedTimer._id); // Use o timer._id ao invés de memoizedTimer._id

      // 2) Obtenha o documento mais recente do banco de dados
      const existingDoc = await remoteDB.get(memoizedTimer._id); // Certifique-se de que estamos pegando o timer correto
      const newRev = existingDoc._rev; // Atualiza com o _rev mais recente

      // 3) Atualize o documento com o _rev correto
      const updatedTimer = {
        ...updatedDoc,
        _rev: newRev, // Garante que o _rev seja o correto
      };

      // 4) Adiciona o novo timer
      await addTimer(updatedTimer);

      // Atualiza o estado local
      setUltimoAgendamento(agendamentoData);
      setResponsavelAgendamento(user?.name || "Desconhecido");

      // 5) Envia o comando MQTT
      await sendCommand(
        `SendOff${alertData.monitor}`,
        `Comando SendOff${alertData.monitor}`,
        timer
      );

      console.log("✅ Agendamento e comando enviados com sucesso");

    } catch (err) {
      if (err.name === "conflict") {
        // Lide com o erro de conflito, talvez tentando outra abordagem ou notificando o usuário
        console.error("❌ Conflito de versão no agendamento:", err);
        setResponseMsg("❌ Conflito ao salvar agendamento.");
      } else {
        console.error("❌ Erro ao salvar agendamento:", err);
        setResponseMsg("❌ Erro ao salvar agendamento.");
      }
    }
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
            <label className="block text-sm text-gray-400">Monitor</label>
            <div className="text-sm">{alertData.monitor == 17 ? "Painel 1" : alertData.monitor == 18 ? "Painel 2" : alertData.monitor}</div>
          </div>
          <div>
            <label className="block text-sm text-gray-400">Data</label>
            <div className="text-sm">{alertData.date}</div>
          </div>
          <div>
            <label className="block text-sm text-gray-400">Hora</label>
            <div className="text-sm">{alertData.time}</div>
          </div>
          <div>
            <label className="block text-sm text-gray-400">Status</label>
            <div className="text-sm">
              {valueDescriptions[alertData.status]}
            </div>
          </div>
        </div>



        {/* Intervalo genérico */}
        <div className="p-4 border-t border-[#444]">
          <h3 className="text-sm text-gray-400">
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
              className="w-10 px-2 text-sm bg-[#444444] rounded"
            />
            <span className="text-sm text-gray-300">
              {formatInterval(alarmInterval)}
            </span>
            <button
              type="button"
              onClick={handleAgendamentoClick}
              disabled={loading}
              className={`px-3 py-1 text-sm rounded ${loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600"
                } text-white`}
            >
              {loading ? "Enviando..." : "Agendar"}
            </button>
          </div>

          {memoizedTimer && (
            <div className="">
              <div className="mt-2 text-sm text-gray-400">
                Último agendamento:
                <p className="text-white">{memoizedTimer.ultimo_agendamento}</p>
              </div>
              <div className="mt-2 text-sm text-gray-400">
                Timer agendado:
                <p className="text-white">{memoizedTimer.timer}</p>
              </div>
              <div className="mt-2 text-sm text-gray-400">
                Responsável pelo agendamento:
                {memoizedTimer.responsavel_agendamento && (
                  <p className="text-white">{memoizedTimer.responsavel_agendamento}</p>
                )}
              </div>
              {/* Descrição */}

            </div>
          )}
          <div className="mt-2 text-sm text-gray-400">
            Descrição do alarme:
            <p className="text-white">
              {alertData.description ??
                alarmTypeDescriptions[alertData.alarme] ??
                ""}
            </p>

          </div>

          <div className="mt-6 text-sm text-gray-400 border-t border-[#444]">
            <button
              type="button"
              onClick={handleAgendamentoClick}
              disabled={loading}
              className={`px-3 py-1 my-4 text-sm rounded ${loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600"
                } text-white`}
            >
              {loading ? "Enviando..." : "solucionar alarme"}
            </button>
            <div>
              <div className="mt-2 text-sm text-gray-400">
                Data da solução:{" "}
                <p className="text-white">{ultimoAgendamento}</p>
              </div>
              <p>Responsável pela solução do alarme:</p>
              <p className="text-white">
                henrique.martins@wyrd.com.br
              </p>
            </div>


          </div>


          {responseMsg && (
            <div
              className="mt-1 text-sm"
              style={{
                color: responseMsg.startsWith("✅")
                  ? "#4ade80"
                  : "#f87171",
              }}
            >
              {responseMsg}
            </div>
          )}
        </div>



        <div className="p-4 border-[#444]">
          <input
            type="checkbox"
            checked={whatsappStatus}
            onChange={handleToggleChange}
            className="p-4"
          />
          {whatsappStatus == false ? <label className="ml-2 text-gray-400">Notificações pelo Whatsapp DESATIVADAS</label> : <label className="ml-2 text-gray-400">Notificações pelo Whatsapp ATIVADAS</label>}

        </div>





      </form>
    </div>
  );
}
