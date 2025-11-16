import { useMemo } from "react";
import useMessageStore from "../stores/messageStore";

const useLatestAlertasPorMonitor = () => {
  const { parsedMessages = [], isLoading, error } = useMessageStore();

  const latestAlertas = useMemo(() => {
    if (isLoading || error) return [];

    // 1) Filtrar e parsear mensagens
    const alerts = parsedMessages
      .filter(
        msg =>
          msg &&
          msg.origin === "esp32" &&
          msg.type === "string" &&
          typeof msg.data === "string" &&
          msg.data.length === 32
      )
      .map(({ data }) => {
        const parts = data.split(";");
        if (parts.length < 3) {
          console.warn("Mensagem inválida (expected 3 parts):", data);
          return null;
        }
        const [idFrag, rawDate, value] = parts;

        if (!value || value.length < 5) {
          console.warn("Mensagem inválida (payload curto):", data);
          return null;
        }

        // separar data e hora (suporta "T" ou espaço)
       const dateTimeParts = rawDate.split("T" || " ");
        if (dateTimeParts.length !== 2) {
          console.warn("Data inválida (deve ser 'YYYY-MM-DD HH:mm:ss'):", rawDate);
          return null;
        }
        const [datePart, timePart] = dateTimeParts;

        const dateItems = datePart.split("-");
        const timeItems = timePart.split(":");
        if (dateItems.length !== 3 || timeItems.length !== 3) {
          console.warn("Data inválida (partes incorretas):", rawDate);
          return null;
        }

        const [year, month,day ] = dateItems.map(Number);
        const [hour, minute, second] = timeItems.map(Number);
        const dt = new Date(year, month - 1, day, hour, minute, second);

        if (isNaN(dt.getTime())) {
          console.warn("Data inválida (Date inválido):", rawDate);
          return null;
        }

        const date = dt.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        const irrigadorId = idFrag.replace(/\D/g, "");
        const alarme = value[0];
        const monitor = value.substring(1, 3);
        const status = value[3];
        const armadilha = value[4];

        // incluímos dt para facilitar comparação
        return { irrigadorId, date, alarme, monitor, status, armadilha, dt };
      })
      .filter(Boolean);

    // 2) Agrupar por monitor e manter só o mais recente
    const latestMap = new Map();
    for (const alert of alerts) {
      const prev = latestMap.get(alert.monitor);
      if (!prev || alert.dt > prev.dt) {
        latestMap.set(alert.monitor, alert);
      }
    }

    // 3) Converter pra array e remover dt (campo interno)
    return Array.from(latestMap.values()).map(({ dt, ...rest }) => rest);
  }, [parsedMessages, isLoading, error]);

  return { latestAlertas, isLoading, error };
};

export default useLatestAlertasPorMonitor;
