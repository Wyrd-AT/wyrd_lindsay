import React from "react";
import { Link } from "react-router-dom";
import { FiAlertOctagon } from "react-icons/fi";

/**
 * userType: "cliente" | "revenda" | "admin"
 * - cliente: não exibe nenhum nome (cliente, revenda, admin)
 * - revenda: exibe só nome do cliente
 * - admin: exibe revenda e cliente
 */
const IrrigadorCard = React.memo(function IrrigadorCard({
  machineId,
  displayName,
  nomeCliente,
  nomeRevenda,
  nomeAdmin,
  cnpjCliente,
  cnpjRevenda,
  cnpjAdmin,
  revendaId,
  ownerId,
  userType,
  lastAlertDate,
  alertCount,
  loadingRecent,
}) {
  const showCliente = userType === "revenda" || userType === "admin" || userType === "superadmin";
  const showRevenda = userType === "admin" || userType === "superadmin";
  const showAdmin = userType === "superadmin";

  const clienteInfo = nomeCliente || cnpjCliente || ownerId || "—";
  const revendaInfo = nomeRevenda || cnpjRevenda || revendaId || "—";
  const adminInfo = nomeAdmin || cnpjAdmin || "—";

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
        flex flex-row w-full min-h-[230px] px-4 py-3 gap-4 items-center
        bg-[#39393a] hover:bg-[#4a4a4b]
        rounded-lg overflow-hidden
        transition-shadow shadow-sm hover:shadow-md
        no-underline text-white
        ${borderClass}
      `}
    >
      <div className="flex-shrink-0 flex items-center justify-center w-40">
        <img
          src="/irrigador (1).svg"
          alt={displayName}
          className="h-32 object-contain filter brightness-0 invert"
        />
      </div>

      <div className="flex-1 flex flex-col justify-center min-w-0">
        <div>
          <h3 className="text-4xl font-semibold truncate">
            Pivô {displayName}
          </h3>
          {showCliente && (
            <p className="text-base text-gray-400 break-words">
              Cliente: {clienteInfo}
            </p>
          )}
          {showRevenda && (
            <p className="text-base text-gray-400 break-words">
              Revenda: {revendaInfo}
            </p>
          )}
          {showAdmin && (
            <p className="text-base text-gray-400 break-words">
              Admin: {adminInfo}
            </p>
          )}
          <p className="text-base leading-snug text-gray-300 break-words pr-2">
            {lastAlertDate
              ? `Último dado: ${lastAlertDate}`
              : "Último dado: não encontrado"}
          </p>
        </div>

        <div className="flex items-center justify-start">
          <span
            className={`
              w-fit flex items-center justify-start p-3 rounded-md ${badgeClass}
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
          {loadingRecent && !lastAlertDate && (
            <span className="ml-3 text-xs px-2 py-1 rounded bg-gray-500 text-gray-200 animate-pulse">
              Carregando...
            </span>
          )}
          {!loadingRecent && !lastAlertDate && (
            <span className="ml-3 text-xs px-2 py-1 rounded bg-gray-600 text-gray-200">
              Sem dados
            </span>
          )}
        </div>
      </div>
    </Link>
  );
})

export default IrrigadorCard;
