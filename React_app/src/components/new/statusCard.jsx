import clsx from "clsx";
import { valueDescriptions } from "../../constants/alertDescriptions";

// Mapeamento legado (exportado para compatibilidade)
export const STATUS_MAP = {
  0: "Normal",
  1: "Alarmado",
  2: "Reconhecido",
  3: "Alarme OFF",
  9: "Ausente",
};

export function StatusCard({ title, statuses, onClick, isInMaintenance }) {
  const allOK = statuses.some((s) => s.value === "0");
  const hasAlarmado = statuses.some((s) => s.value === "1");
  const hasReconhecido = statuses.some((s) => s.value === "2");
  const hasAlarmeOff = statuses.some((s) => s.value === "3");
  const hasAusente = statuses.some((s) => s.value === "9");

  const statusLabel = isInMaintenance
    ? "Em manutenção"
    : hasAlarmado
      ? "Alarmado"
      : hasReconhecido
        ? "Reconhecido"
        : allOK
          ? "Normal"
          : hasAlarmeOff
            ? "Alarme OFF"
            : hasAusente
              ? "Ausente"
              : "Desconhecido";

  const classes = clsx(
    "h-full flex flex-col items-center justify-center rounded border-2 p-2 transition-colors duration-200 cursor-pointer",
    {
      "animate-blink-bg border-red-500 text-white": hasAlarmado,
      "bg-red-500 border-transparent text-white":
        !hasAlarmado && hasReconhecido,
      "bg-[#08cb7c] border-[#08cb7c] text-white": allOK && !hasAlarmado,
      "bg-[#444444] border-transparent text-white":
        (!allOK && !hasAlarmado && !hasReconhecido) || isInMaintenance,
    },
  );

  return (
    <div className={classes} onClick={onClick}>
      <span className="font-semibold">{title}</span>
      <span className="mt-1 text-sm">{statusLabel}</span>
      <div className="mt-2 flex flex-col items-start gap-1 text-xs">
        {statuses.map((s) => {
          const isTensionField =
            s.label === "Falha por tensão" || s.label === "Tensão (V)";
          const desc = isTensionField
            ? s.value
            : valueDescriptions[s.value] || s.value;
          return (
            <div key={s.label} className="flex items-center">
              <span className="font-medium px-1">{s.label}:</span>
              <span>{desc}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
