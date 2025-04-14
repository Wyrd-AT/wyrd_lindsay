import React, { useState } from "react";
import { IoMdDownload } from "react-icons/io"; // Ícone de download
import { FaChevronDown } from "react-icons/fa"; // Ícone de seta para dropdown

export default function SelectExport({ onclick_details, onClose_details }) {
  const [selectedMachine, setSelectedMachine] = useState("IRRIGADOR 01");

  return (
    <div className="w-full h-auto px-8 py-2 flex justify-between items-center">
      {/* Dropdown de seleção */}
      <div className="relative border-b border-gray-500 flex items-center">
        <select
          className="bg-transparent text-white text-sm font-medium appearance-none pr-6 pl-2 cursor-pointer outline-none"
          value={selectedMachine}
          onChange={(e) => setSelectedMachine(e.target.value)}
        >
          <option value="IRRIGADOR 01" className="text-black">IRRIGADOR 01</option>
          <option value="IRRIGADOR 02" className="text-black">IRRIGADOR 02</option>
          <option value="IRRIGADOR 03" className="text-black">IRRIGADOR 03</option>
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
