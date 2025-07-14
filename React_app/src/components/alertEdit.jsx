import React, { useEffect, useState, useRef } from "react";
import { IoClose } from "react-icons/io5";
import { FiShare2 } from "react-icons/fi";
import { useMessageStore } from "../stores/messageStore";

// Mapeamento para display
const irrigadorIdMap = {
  "111111": "1",
  "222222": "2",
  "333333": "3",
};

const formatAlertId = (alertId) => {
  const [rawId, index] = alertId.split("-");
  const mapped = irrigadorIdMap[rawId] || rawId;
  return `#${mapped}-${index}`;
};

function getBrasiliaTimestamp() {
  const dt = new Date();

  // Converte para horário de Brasília
  const brTime = new Date(
    dt.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );

  // Ajusta o offset de -03:00
  const offsetMs = brTime.getTimezoneOffset() * 60000;
  const localISO = new Date(brTime.getTime() - offsetMs).toISOString();

  // Insere manualmente o fuso -03:00
  return localISO.replace("Z", "-03:00");
}

function getStatusBadge(status) {
  switch (status) {
    case "Não resolvido":
      return (
        <span className="bg-transparent text-[#E83838] border border-[#E83838] px-2 py-1 rounded-full text-xs">
          Não resolvido
        </span>
      );
    case "Em progresso":
      return (
        <span className="bg-transparent text-[#C7A20D] border border-[#C7A20D] px-2 py-1 rounded-full text-xs">
          Em progresso
        </span>
      );
    case "Resolvido":
      return (
        <span className="bg-transparent text-[#42AE10] border border-[#42AE10] px-2 py-1 rounded-full text-xs">
          Resolvido
        </span>
      );
    default:
      return null;
  }
}

export default function AlertEdit({ isOpen, onClose, alertData }) {


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black opacity-25" />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-[#2f2f2f] text-white  rounded-md w-full max-w-md flex flex-col items-center align-middle justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        <div className=" text-white p-4 rounded-md w-full max-w-md flex flex-row items-center align-middle justify-between">
          <div>Alerta</div>
          <button
            className=""
            onClick={onClose}
            aria-label="Fechar"
          >
            <IoClose />
          </button>
        </div>
        <div className="w-full max-w-md flex flex-row items-center align-middle justify-between px-4">
          <div>
            ID
          </div>
          <div>
            data
          </div>
          <div>
            hora
          </div>
          <div className="border rounded-full border-red-500 text-red-500 px-4">
            status
          </div>
        </div>
        <div className="w-full max-w-md flex flex-col items-center align-middle justify-between py-2 px-4">
          <p className=" w-full max-w-md py-2">
            Descrição
          </p>
          <textarea className="w-full max-w-md rounded-md bg-[#444444]">

          </textarea>
        </div>
        <div className="w-full max-w-md flex flex-col items-center align-middle justify-between pb-2 px-4">
          <p className=" w-full max-w-md py-2">
            Responsável
          </p>
          <textarea className="w-full max-w-md rounded-md bg-[#444444]">

          </textarea>
        </div>
        <div className="w-full max-w-md flex flex-row items-center align-middle  pb-2 px-4">
          <div className="border rounded-full border-green-500 bg-green-500 px-4 mr-2">
            Ligar Alarme
          </div>
          <div className="border rounded-full border-yellow-500 bg-yellow-500 px-4">
            Desligar Alarme
          </div>

        </div>
        <div className="w-full max-w-md flex flex-row items-center align-middle  pb-2 px-4">
          
        </div>




      </div>

    </div>
  );
}
