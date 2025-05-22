// components/SelectExport.jsx
import React, { useState, useEffect } from "react";
import { IoMdDownload } from "react-icons/io";
import { FaChevronDown, FaBolt, FaRegEnvelope, FaSearch, FaInfo, FaInfoCircle } from "react-icons/fa";
import { FiAlertCircle, FiAlertTriangle } from "react-icons/fi";
import { useNavigate, useLocation } from "react-router-dom";

export default function SelectExport({
  machines = [],           // ex. ["IRRIGADOR AB1B1B", ...]
  onclick_details,
  onExport,
  onAlarm,                  // callback para botão Alarme
  onTension,                // callback para botão Tensão
  onMessage,                // callback para botão Mensagem
  onMachineChange,
  redirectBase = "/maquina"
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedMachine, setSelectedMachine] = useState("");

  // Sincroniza o select *uma única vez* quando trocar de rota ou de lista:
  useEffect(() => {
    if (!machines.length) return;
    const last = location.pathname.split("/").pop();
    const match = machines.find(
      (m) => m.replace(/^IRRIGADOR\s*/, "") === last
    );
    const newSel = match || machines[0];
    setSelectedMachine((prev) => (prev === newSel ? prev : newSel));
  }, [location.pathname, machines]);

  const handleChange = (e) => {
    const newMachine = e.target.value;
    setSelectedMachine(newMachine);
    onMachineChange?.(newMachine);
    const machineId = newMachine.replace(/^IRRIGADOR\s*/, "");
    navigate(`${redirectBase}/${machineId}`);
  };

  return (
    <div className="w-full px-8 py-2 flex justify-between items-center bg-[#13131]">
      {/* dropdown */}
      <div className="relative bg-gray-700 border-b border-gray-600 rounded flex items-center">
        <select
          className="bg-gray-600 text-white text-sm font-medium appearance-none pr-6 pl-2 py-1 cursor-pointer outline-none"
          value={selectedMachine}
          onChange={handleChange}
        >
          {machines.map((machine) => (
            <option
              key={machine}
              value={machine}
              className="bg-gray-600 text-white"
            >
              {machine}
            </option>
          ))}
        </select>
        <FaChevronDown className="absolute right-2 text-white text-xs pointer-events-none" />
      </div>

      {/* botões de ação */}
      <div className="flex items-center gap-3">
        {/* Botão Alarme */}
        <button
          onClick={onAlarm}
          className="bg-gray-700 text-white text-sm font-medium px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition"
        >
          <FiAlertTriangle size={16} />
          Alarme
        </button>

        {/* Botão Tensão */}
        <button
          onClick={onTension}
          className="bg-gray-700 text-white text-sm font-medium px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition"
        >
          <FaBolt size={16} />
          Tensão
        </button>

        {/* Botão Exportar */}
        <button
          onClick={onExport}
          className="bg-gray-700 text-white text-sm font-medium px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition"
        >
          <IoMdDownload />
          Exportar 
        </button>
        
        {/* Botão Mensagem */}
        <button
          onClick={onMessage}
          className="bg-gray-700 text-white text-sm font-medium px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition"
        >
          <FaRegEnvelope size={16} />
        </button>

      </div>
    </div>
  );
}
