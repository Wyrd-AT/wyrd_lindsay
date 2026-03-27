import React, { useState, useEffect, useMemo } from "react";
import Select, { components } from "react-select";
import { IoMdDownload } from "react-icons/io";
import { FaRegEnvelope, FaTimes } from "react-icons/fa";
import { useNavigate, useLocation } from "react-router-dom";
import {
  useAuthStore,
  selectCanSendCommands,
} from "../../stores/new/authStore";

export default function SelectExport({
  getDisplayName = (id) => id, // função para exibir "IRRIGADOR X"
  onclick_details,
  onExport,
  onMessage,
  onMachineChange,
  selectedMachine,
  redirectBase = "/maquina",
}) {
  const canSendCommands = useAuthStore(selectCanSendCommands);
  return (
    <div className="w-full  py-2 flex justify-between items-center bg-[#13131]">
      <div className="relative bg-gray-700 border-b border-gray-600 rounded flex-none w-fit px-8 items-center flex text-center ">
        <div className="text-white">
          {getDisplayName((selectedMachine ?? [1])[0])}
        </div>
      </div>

      {/* botões de ação */}
      <div className="flex items-center gap-3">
        {canSendCommands && (
          <button
            onClick={onMessage}
            className="bg-gray-700 text-white text-sm font-medium px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition"
          >
            <FaRegEnvelope size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
