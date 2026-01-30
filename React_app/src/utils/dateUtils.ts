// Função utilitária para gerar ISO string no fuso de Brasília
export function getBrasiliaTimestamp(): string {
  const dtf = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(new Date());
  const year   = parts.find(p => p.type === "year")?.value;
  const month  = parts.find(p => p.type === "month")?.value;
  const day    = parts.find(p => p.type === "day")?.value;
  const hour   = parts.find(p => p.type === "hour")?.value;
  const minute = parts.find(p => p.type === "minute")?.value;
  const second = parts.find(p => p.type === "second")?.value;

  // Ajusta o offset de -03:00 (horário de Brasília)
  return `${year}-${month}-${day}T${hour}:${minute}:${second}-03:00`;
}
