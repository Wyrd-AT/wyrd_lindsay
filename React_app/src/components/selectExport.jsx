// components/SelectExport.jsx
import React, { useState, useEffect } from "react";
import { IoMdDownload } from "react-icons/io"; // Ícone de download
import { FaChevronDown } from "react-icons/fa"; // Ícone de seta para dropdown
import { useNavigate } from "react-router-dom"; // Para redirecionamento

export default function SelectExport({ 
  machines = [], 
  onclick_details, 
  onClose_details, 
  onMachineChange, 
  redirectBase = "/maquina" // valor padrão, pode ser sobrescrito
}) {
  const navigate = useNavigate();
  const [selectedMachine, setSelectedMachine] = useState(machines[0] || "");

  useEffect(() => {
    if (machines && machines.length > 0 && !machines.includes(selectedMachine)) {
      setSelectedMachine(machines[0]);
    }
  }, [machines, selectedMachine]);

  const handleChange = (e) => {
    const newMachine = e.target.value;
    setSelectedMachine(newMachine);

    if (onMachineChange) {
      onMachineChange(newMachine);
    }

    // Redireciona para a rota baseada na prop redirectBase
    navigate(`${redirectBase}/${newMachine}`);
  };

  return (
    <div className="w-full h-auto px-8 py-2 flex justify-between items-center">
      {/* Dropdown de seleção */}
      <div className="relative border-b border-gray-500 flex items-center">
        <select
          className="bg-transparent text-white text-sm font-medium appearance-none pr-6 pl-2 cursor-pointer outline-none"
          value={selectedMachine}
          onChange={handleChange}
        >
          {machines.map((machine) => (
            <option key={machine} value={machine} className="text-black">
              {machine}
            </option>
          ))}
        </select>
        <FaChevronDown className="absolute right-2 text-white text-xs pointer-events-none" />
      </div>

      {/* Botões de Ação */}
      <div className="flex gap-3">
        {/* Botão "Ver Detalhes Máquina" */}
        <button
          className="text-white text-sm font-medium px-4 py-1 border border-white rounded-full flex items-center gap-2 hover:bg-white hover:text-black transition"
          onClick={onclick_details}
        >
          ver detalhes máquina →
        </button>

        {/* Botão "Exportar" */}
        <button className="text-white text-sm font-medium px-4 py-1 border border-white rounded-full flex items-center gap-2 hover:bg-white hover:text-black transition">
          exportar <IoMdDownload />
        </button>
      </div>
    </div>
  );
}
