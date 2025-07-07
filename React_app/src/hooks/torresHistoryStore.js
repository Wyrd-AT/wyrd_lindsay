import { useMemo } from "react";
import useMessageStore from "../stores/messageStore";

const useTorresHistoryStore = () => {
  const { parsedMessages = [], isLoading, error } = useMessageStore();

  const painelNames = [
    "Painel 1", "Painel 2", "MT01", "MT02", "MT03", "MT04", "MT05",
    "MT06", "MT07", "MT08", "MT09", "MT10", "MT11", "MT12", "MT13", "MT14"
  ];

  const torresHistory = useMemo(() => {
    if (isLoading || error) return [];

    const processed = parsedMessages
      // Filtra mensagens válidas com origin="esp32" e type="string"
      .filter(
        msg =>
          msg &&
          msg.origin === "esp32" &&
          msg.type === "string" &&
          typeof msg.data === "string"
      )
      .map(({ data }) => {
        const parts = data.split(";");

        // Verifica se a mensagem possui 18 partes (baseado no exemplo dado)
        if (parts.length !== 18) {
          console.warn("Mensagem inválida (esperado 18 partes):", data);
          return null;
        }

        const [idFrag, rawDate, ...values] = parts;

        // Verifica se o ID ou a data estão ausentes
        if (!idFrag || !rawDate || values.length < 15) {
          console.warn("Mensagem inválida (dados ausentes ou incompletos):", data);
          return null;
        }

        // Valida a formatação de rawDate (YYYY-MM-DD HH:mm:ss)
        const [datePart, timePart] = rawDate.split(" ");
        if (!datePart || !timePart || datePart.split("-").length !== 3 || timePart.split(":").length !== 3) {
          console.warn("Data inválida (formato incorreto):", rawDate);
          return null;
        }

        // Converte para um Date válido
        const [year, month, day] = datePart.split("-").map(Number);
        const [hour, minute, second] = timePart.split(":").map(Number);
        const dt = new Date(year, month - 1, day, hour, minute, second);

        if (isNaN(dt.getTime())) {
          console.warn("Data inválida (Date inválido):", rawDate);
          return null;
        }

        // Formata a data no formato pt-BR
        const date = dt.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        // Agora associamos os valores de 0 a 15 com os nomes dos painéis
        const painelData = values.map((value, index) => {
          if (painelNames[index] === "Painel 1" || painelNames[index] === "Painel 2") {
            return {
              painel: painelNames[index], 
              Painel: value[0],
              SW1: "n/a", // Primeiro caractere para SW1
              SW2:"n/a", // Segundo caractere para SW2
              Armadilha:"n/a", // Terceiro caractere para Armadilha
            };
          }
          if (painelNames[index].startsWith("MT")) {
            // Para MT01 até MT14, dividir em 3 partes
            return {
              painel: painelNames[index],
              Painel: "n/a",
              SW1: value[0] || "n/a", // Primeiro caractere para SW1
              SW2: value[1] || "n/a", // Segundo caractere para SW2
              Armadilha: value[2] || "n/a", // Terceiro caractere para Armadilha
            };
          }
          return { painel: painelNames[index], value: value }; // Caso padrão
        });

        // Retorna o objeto com o id do irrigador, a data convertida e os painéis com valores
        return { irrigadorId: idFrag, date: date, painelData };
      })
      .filter(Boolean); // Remove elementos null (mensagens inválidas)

    // Ordena as mensagens pela data em ordem decrescente (mais recente primeiro)
    return processed.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [parsedMessages, isLoading, error]);

  return { torresHistory, isLoading, error };
};

export default useTorresHistoryStore;
