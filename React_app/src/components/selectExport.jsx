// components/SelectExport.jsx
import React, { useState, useEffect } from "react";
import { IoMdDownload } from "react-icons/io";
import { FaChevronDown } from "react-icons/fa";
import { useNavigate } from "react-router-dom";

export default function SelectExport({
  machines = [],           // ex. ["IRRIGADOR AB1B1B", "IRRIGADOR EC2C2C", ...]
  onclick_details,
  onClose_details,
  onMachineChange,
  redirectBase = "/maquina"
}) {
  const navigate = useNavigate();
  const [selectedMachine, setSelectedMachine] = useState(machines[0] || "");

  useEffect(() => {
    // quando a lista mudar, garante que o selectedMachine exista
    if (machines.length > 0 && !machines.includes(selectedMachine)) {
      setSelectedMachine(machines[0]);
    }
  }, [machines]);

  const handleChange = (e) => {
    const newMachine = e.target.value;
    setSelectedMachine(newMachine);

    // notifica o pai (Maquina.jsx) se necessário
    if (onMachineChange) {
      onMachineChange(newMachine);
    }

    // extrai só o código após o prefixo "IRRIGADOR "
    const machineId = newMachine.replace(/^IRRIGADOR\s*/, "");

    // navega para /maquina/<machineId>
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
            <option key={machine} value={machine} className="bg-gray-600 text-white">
              {machine}
            </option>
          ))}
        </select>
        <FaChevronDown className="absolute right-2 text-white text-xs pointer-events-none" />
      </div>

      {/* botões de ação */}
      <div className="flex gap-3">
        <button
          onClick={onclick_details}
          className="bg-gray-700 text-white text-sm font-medium px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition"
        >
          ver detalhes máquina →
        </button>
        <button
          className="bg-gray-700 text-white text-sm font-medium px-4 py-1 border border-gray-600 rounded-full flex items-center gap-2 hover:bg-gray-600 transition"
        >
          exportar <IoMdDownload />
        </button>
      </div>
    </div>
  );
}
