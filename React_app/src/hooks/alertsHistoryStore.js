import { useMemo } from "react";
import useMessageStore from "../stores/messageStore";

const useHistoricoAlertasStore = () => {
  const { parsedMessages = [], isLoading, error } = useMessageStore();


  const historicoAlertas = useMemo(() => {
    if (isLoading || error) return [];

    const processed = parsedMessages
      .filter(
        msg =>
          msg &&
          msg.origin === "esp32" &&
          msg.type === "string" &&
          typeof msg.data === "string" && msg.data.length==32
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

        const [year,day, month ] = dateItems.map(Number);
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

        return { irrigadorId, date, alarme, monitor, status, armadilha };
      })
      .filter(Boolean);

    // Para criar um histórico, vamos armazenar todos os alertas processados

    // Adiciona os novos alertas ao histórico
    const novoHistorico = [ ...processed];

    // Elimina duplicatas por irrigadorId+date
    const uniqueMap = new Map();
    novoHistorico.forEach(alert => {
      const key = `${alert.irrigadorId}-${alert.date}`;
      if (!uniqueMap.has(key)) uniqueMap.set(key, alert);
    });

    // Salva o histórico atualizado no localStorage
    localStorage.setItem("historicoAlertas", JSON.stringify(Array.from(uniqueMap.values())));

    return Array.from(uniqueMap.values());
  }, [parsedMessages, isLoading, error]);
  return { historicoAlertas, isLoading, error };
};

export default useHistoricoAlertasStore;
