// components/IrrigadorCard.jsx
import React from "react";
import { Link } from "react-router-dom";
import { FiAlertOctagon, FiChevronRight } from "react-icons/fi";

export default function IrrigadorCard({
  machineId,
  lastAlertDate,
  alertCount,
}) {
  return (
    <Link
      to={`/maquina/${machineId}`}
      className={`
        flex flex-row
        w-1/4 h-32          /* largura 25% e altura fixa */
        bg-[#39393a] hover:bg-[#4a4a4b]
        border-b border-gray-700
        rounded-lg overflow-hidden
        transition-shadow shadow-sm hover:shadow-md
        m-4 no-underline text-white
      `}
    >
      {/* imagem com padding menor */}
      <div className="flex-shrink-0 flex items-center justify-center p-2">
        <img
          src="/irrigador (1).svg"
          alt={`Irrigador ${machineId}`}
          className="
            w-16 h-16
            object-contain
            filter brightness-0 invert
          "
        />
      </div>

      {/* conteúdo textual: ocupa o restante, com padding reduzido */}
      <div className="flex-1 flex flex-col justify-between p-2">
        <div>
          <h3 className="text-base font-semibold truncate">
            Irrigador {machineId}
          </h3>
          <p className="text-xs text-gray-300 truncate">
            {lastAlertDate
              ? `Último alerta: ${lastAlertDate}`
              : "Sem alertas"}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <span
            className={`
              inline-flex items-center 
              ${alertCount > 0 ? "bg-red-500" : "bg-gray-600"} 
              px-2 py-0.5 rounded-full text-xs font-medium
            `}
          >
            <FiAlertOctagon className="mr-1" size={14} />
            {alertCount}
          </span>
          <FiChevronRight size={16} />
        </div>
      </div>
    </Link>
  );
}
