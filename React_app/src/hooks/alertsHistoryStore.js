import { useState, useEffect } from "react";
import useMessageStore from "../stores/messageStore";

export default function useHistoricoAlertasStore() {
  const { parsedMessages = [], isLoading, error } = useMessageStore();

  // 1. O estado reativo que armazena os alertas. É a "única fonte da verdade".
  const [historicoAlertas, setHistoricoAlertas] = useState([]);

  // 2. Efeito para carregar os dados do localStorage APENAS UMA VEZ, no início.
  useEffect(() => {
    const storedHistorico = localStorage.getItem("historicoAlertas");
    if (storedHistorico) {
      setHistoricoAlertas(JSON.parse(storedHistorico));
    }
  }, []); // O array vazio [] garante que isso rode apenas na montagem.

  // 3. Efeito para processar novas mensagens e atualizar o estado.
  useEffect(() => {
    // Não faz nada se estiver carregando ou se não houver novas mensagens.
    if (isLoading || parsedMessages.length === 0) {
      return;
    }

    // A sua lógica de processamento de mensagens permanece a mesma.
    const processed = parsedMessages
      .filter(
        (msg) =>
          msg &&
          msg.origin === "esp32" &&
          msg.type === "string" &&
          typeof msg.data === "string" &&
          msg.data.length === 32
      )
      .map(({ data }) => {
        // ...toda a sua lógica de parsing...
        // (código omitido por brevidade, mas é o mesmo que você já tinha)
        const parts = data.split(";");
        if (parts.length < 3) return null;
        const [idFrag, rawDate, value] = parts;
        if (!value || value.length < 5) return null;
        const dt = new Date(rawDate.replace(/-/g, "/")); // Simplificação do parse de data
        if (isNaN(dt.getTime())) return null;

        return {
          irrigadorId: idFrag.replace(/\D/g, ""),
          date: dt.toISOString(), // Use ISO string para consistência
          alarme: value[0],
          monitor: value.substring(1, 3),
          status: value[3],
          armadilha: value[4],
        };
      })
      .filter(Boolean);

    // Combina o estado atual com os novos alertas processados e remove duplicatas
    setHistoricoAlertas((currentHistorico) => {
      const combined = [...currentHistorico, ...processed];
      const uniqueMap = new Map();
      combined.forEach((alert) => {
        const key = `${alert.irrigadorId}-${alert.date}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, alert);
        }
      });
      return Array.from(uniqueMap.values());
    });
  }, [parsedMessages, isLoading]); // Roda quando novas mensagens chegam

  // 4. Efeito para salvar no localStorage SEMPRE que o estado `historicoAlertas` mudar.
  useEffect(() => {
    // Evita salvar o estado inicial vazio se o localStorage já tiver dados.
    if (historicoAlertas.length > 0) {
      localStorage.setItem("historicoAlertas", JSON.stringify(historicoAlertas));
    }
  }, [historicoAlertas]);

  // 5. A função `updateAlert` agora modifica o ESTADO, que é reativo.
  const updateAlert = (updatedAlert) => {
    setHistoricoAlertas((currentHistorico) =>
      // Usa .map() para criar um NOVO array (imutabilidade)
      currentHistorico.map((alert) =>
        alert.date === updatedAlert.date && alert.irrigadorId === updatedAlert.irrigadorId
          ? { ...alert, ...updatedAlert } // Se for o alerta, mescla com os dados novos
          : alert // Senão, mantém o alerta original
      )
    );
  };

  return { historicoAlertas, isLoading, error, updateAlert };
}