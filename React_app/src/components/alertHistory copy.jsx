import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  FiAlertOctagon,
  FiChevronDown,
  FiChevronUp,
  FiClock
} from "react-icons/fi";
import AlertEdit from "./alertEdit.jsx";
import { PiSirenBold } from "react-icons/pi";
import clsx from "clsx";
import { HiOutlineShieldExclamation } from "react-icons/hi";
import useTorresHistoryStore from "../stores/torresHistoryStore.js";
import useHistoricoAlertasStore from "../stores/alertsHistoryStore.js";

// Gera badge de status
function getStatusBadge(status) {
  switch (status) {
    case "Não resolvido":
      return (
        <span className="bg-[#FFE0E5] text-[#E83838] border border-[#E83838] px-2 py-1 rounded text-xs">
          Não resolvido
        </span>
      );
    case "Em progresso":
      return (
        <span className="bg-[#FAFAFA] text-[#C7A20D] border border-[#C7A20D] px-2 py-1 rounded text-xs">
          Em progresso
        </span>
      );
    case "Resolvido":
      return (
        <span className="bg-[#C1E1B2] text-[#42AE10] border border-[#42AE10] px-2 py-1 rounded text-xs">
          Resolvido
        </span>
      );
    default:
      return null;
  }
}

export default function AlertHistory({ machineId }) {
  const [isOpen, setIsOpen] = useState(true);
  const { torresHistory, isLoading, error } = useTorresHistoryStore();  // Using the hook here
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const { historicoAlertas, isLoading: isLoadingAlertas, error: error_alerts } = useHistoricoAlertasStore();

  // Map de exibição amigável
  const irrigadorIdMap = {
  const irrigadorIdMap = {
    "111111": "1",
    "222222": "2",
    "333333": "3"
  };
  const getDisplayName = (id) => `IRRIGADOR ${irrigadorIdMap[id] || id}`;

  const idClean = machineId.replace("IRRIGADOR ", "");

  // Captura toggle
  const handleToggle = (e) => setIsOpen(e.target.open);

  // Filtra eventos de alerta com base no histórico de torres
  const alertsFromDB = useMemo(
    () =>
      torresHistory.filter(
        (msg) => msg.irrigadorId === idClean
      ),
    [torresHistory, idClean]
  );

  const STATUSES = ["Não resolvido", "Em progresso", "Resolvido"];
  const statusMapRef = useRef({});
  useEffect(() => {
    statusMapRef.current = {};
  }, [idClean]);

  const realAlerts = useMemo(() => {
  return alertsFromDB
    .map((msg, i) => {
      const id = `${msg.irrigadorId}-${i}`;
      if (!statusMapRef.current[id]) {
        const rnd = STATUSES[Math.floor(Math.random() * STATUSES.length)];
        statusMapRef.current[id] = rnd;
      }
      const status = ["OK",'Alarmado',"Alarme reconhecido","Resolvido","Ausente"]
      const dt = msg.date; // 30/06/2025, 14:46:05
      const data = dt.split(",")[0]; // Data
      const hora = dt.split(",")[1]; // Hora
      return {
        id,
        date: data,
        time: hora,
        machine: getDisplayName(msg.irrigadorId),
        description: `Tipo: ${msg.painelData[0]?.painel} | Código: [
        ${msg.painelData[0]?.Painel},
        ${msg.painelData[0]?.SW1},
        ${msg.painelData[0]?.SW1=="n/a"?"OK":status[msg.painelData[0]?.SW1]},
        ${msg.painelData[0]?.Armadilha=="n/a"?"OK":status[msg.painelData[0]?.Armadilha]},
        ${msg.painelData[0]?.Armadilha}]`,
        status: statusMapRef.current[id],
        timestamp: new Date(`${data} ${hora}`).getTime() // Convertendo data e hora para timestamp
      };
    })
    .sort((a, b) => (b.timestamp - a.timestamp)); // Ordena do mais recente para o mais antigo
}, [alertsFromDB]);


  const hasUnresolved = realAlerts.some(
    (alert) => alert.status === "Não resolvido"
  );

  const [selectedStatus, setSelectedStatus] = useState("Todos");
  const filteredAlerts = realAlerts.filter((a) =>
    selectedStatus === "Todos" ? true : a.status === selectedStatus
  );

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState(null);
  const handleRowClick = (alert) => {
    setEditingAlert(alert);
    setIsEditOpen(true);
  };
  const handleCloseEdit = () => {
    setIsEditOpen(false);
    setEditingAlert(null);
  };

  const handleSirene = async () => {
    if (loadingRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setResponseMsg("");

    try {
      const topic = `lindsay/comandos/${rawId}`;
      ////console.log(rawId);
      const payload = `${rawId};ack`;
      const doc = {
        topic,
        payload,
        origin: "app",
        type: "command",
        qos: 0,
        timestamp: getBrasiliaTimestamp()
      };
      ////console.log("[AlertEdit] Enviando comando:", doc);
      await dbStore.postData(doc);
      setResponseMsg("✅ Comando enviado com sucesso!");
    } catch (err) {
      console.error("[AlertEdit] Erro ao enviar comando:", err);
      setResponseMsg("❌ Falha ao enviar comando.");
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  };

  return (
    <details
      className="bg-[#222] text-white p-2 rounded-md w-full mt-4"
      onToggle={handleToggle}
      open={isOpen}
    >
      <summary
        className={`flex items-center justify-between cursor-pointer font-semibold text-lg select-none mb-2 ${
          hasUnresolved ? "pb-1 text-red-600" : ""
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center">Histórico de Alertas</div>

        <div className="flex items-center space-x-3">
          {realAlerts.some((a) => a.status === "Em progresso") && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500 text-white">
              <FiClock className="mr-1" size={14} />
              {realAlerts.filter((a) => a.status === "Em progresso").length}
            </span>
          )}

          {realAlerts.some((a) => a.status === "Não resolvido") && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500 text-white">
              <FiAlertOctagon className="mr-1" size={14} />
              {realAlerts.filter((a) => a.status === "Não resolvido").length}
            </span>
          )}

          {isOpen ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
        </div>
      </summary>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {["Todos", ...STATUSES].map((st) => (
          <button
            key={st}
            onClick={() => setSelectedStatus(st)}
            className={`px-3 py-1 rounded-lg ${
              selectedStatus === st ? "bg-white text-[#444444]" : "bg-[#616061]"
            }`}
          >
            {st}
          </button>
        ))}
        <button
          onClick={handleSirene}
          disabled={loading}
          className={clsx(
            "bg-red-500 hover:bg-red-600 text-white text-xs font-medium px-3 py-1 rounded-full",
            // faz o botão “piscar”
            realAlerts.filter((a) => a.status === "Não resolvido").length
              ? "animate-blink-bg"
              : realAlerts.filter((a) => a.status === "Em progresso").length
              ? ""
              : "bg-green-300"
          )}
        >
          <span className="flex items-center gap-1">
            {/* faz o ícone da sirene “piscar” */}
            <PiSirenBold
              size={24}
              className={clsx(
                realAlerts.filter((a) => a.status === "Não resolvido").length
                  ? ""
                  : "",
                realAlerts.filter((a) => a.status === "Não resolvido").length
                  ? ""
                  : realAlerts.filter((a) => a.status === "Em progresso").length
                  ? ""
                  : "text-black"
              )}
            />
            <p className="text-lg">
              {loading
                ? "Enviando..."
                : realAlerts.filter((a) => a.status === "Não resolvido")
                    .length
                ? " Desativar Sirene"
                : realAlerts.filter((a) => a.status === "Em progresso")
                    .length
                ? "Sirene Desativada"
                : ""}
            </p>
          </span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-[#444444] text-sm uppercase">
            <tr>
              <th className="px-4 py-2">DATA</th>
              <th className="px-4 py-2">HORA</th>
              <th className="px-4 py-2">MÁQUINA</th>
              <th className="px-4 py-2">DESCRIÇÃO</th>
              <th className="px-4 py-2">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {filteredAlerts.map((alert) => (
              <tr
                key={alert.id}
                onClick={() => handleRowClick(alert)}
                className={`border-b border-gray-600 last:border-b-0 hover:bg-[#3a3a3a] cursor-pointer`}
              >
                <td className="px-4 py-3">{alert.date}</td>
                <td className="px-4 py-3">{alert.time}</td>
                <td className="px-4 py-3">{alert.machine}</td>
                <td className="px-4 py-3">{alert.description}</td>
                <td className="px-1 py-3">{getStatusBadge(alert.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertEdit
        isOpen={isEditOpen}
        onClose={handleCloseEdit}
        alertData={editingAlert}
      />
    </details>
  );
}
