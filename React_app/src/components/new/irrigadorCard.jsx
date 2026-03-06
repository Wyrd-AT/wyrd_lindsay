import React from "react";
import { Link } from "react-router-dom";
import { FiAlertOctagon, FiChevronRight } from "react-icons/fi";

/**
 * userType: "cliente" | "revenda" | "admin"
 * - cliente: não exibe nenhum nome (cliente, revenda, admin)
 * - revenda: exibe só nome do cliente
 * - admin: exibe revenda e cliente
 */
export default function IrrigadorCard({
  machineId,
  displayName,
  nomeCliente,
  nomeRevenda,
  nomeAdmin,
  userType,
  lastAlertDate,
  alertCount,
}) {
  const showCliente = userType === "revenda" || userType === "admin";
  const showRevenda = userType === "admin";
  const showAdmin = false; // nunca exibir nome do admin no card

  // se tiver alerta, pisca border e badge
  const borderClass =
    alertCount > 0
      ? " border-4 border-red-600 animate-blink-border"
      : "border-b border-gray-700";

  const badgeClass =
    alertCount > 0 ? "bg-red-500 animate-blink-bg" : "text-[#39393a]";

  return (
    <Link
      to={`/maquina/${machineId}`}
      className={`
        flex flex-row w-fit h-52 px-4 justify-center
        bg-[#39393a] hover:bg-[#4a4a4b]
        rounded-lg overflow-hidden
        transition-shadow shadow-sm hover:shadow-md
        m-2 no-underline text-white
        ${borderClass}
      `}
    >
      <div className="flex-shrink-0 flex items-center justify-center">
        <img
          src="/irrigador (1).svg"
          alt={displayName}
          className="h-full object-contain filter brightness-0 invert"
        />
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div>
          <h3 className="text-3xl font-semibold truncate">
            Pivô {displayName}
          </h3>
          {showCliente && nomeCliente && (
            <p className="text-base text-gray-400 truncate">
              Cliente: {nomeCliente}
            </p>
          )}
          {showRevenda && nomeRevenda && (
            <p className="text-base text-gray-400 truncate">
              Revenda: {nomeRevenda}
            </p>
          )}
          {showAdmin && nomeAdmin && (
            <p className="text-base text-gray-400 truncate">
              Admin: {nomeAdmin}
            </p>
          )}
          <p className="text-lg text-gray-300 truncate">
            {lastAlertDate ? `Último dado: ${lastAlertDate}` : "Sem alertas"}
          </p>
        </div>

        <div className="flex items-center justify-between">
          <span
            className={`
              w-fit mr-4 flex items-center justify-start p-4 rounded-md ${badgeClass}
            `}
          >
            <FiAlertOctagon className="mr-4 font-bold " size={50} />
            <p className=" font-bold">
              {alertCount == 0
                ? `NENHUM ALERTA`
                : alertCount > 1
                  ? `ALARMADO`
                  : `ATENÇÃO`}
            </p>
          </span>
        </div>
      </div>
    </Link>
  );
}
