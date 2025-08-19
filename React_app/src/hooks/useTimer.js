import { useMemo } from "react";
import useMessageStore from "../stores/messageStore";

const useTimer = () => {
  const { parsedMessages = [], isLoading, error } = useMessageStore();

  const timers = useMemo(() => {
    // Se estiver carregando ou houver erro, retorne um array vazio.
    if (isLoading || error) return [];

    // Filtra as mensagens que atendem às condições necessárias.
    const processed = parsedMessages.filter(
      msg =>
        msg?.table === "agendamento"
    );

    // Retorna as mensagens processadas ou um array vazio caso não tenha encontrado mensagens válidas.
    return processed;
  }, [parsedMessages, isLoading, error]);

  return { timers, isLoadingTimers: isLoading, errorTimers: error };
};

export default useTimer;
