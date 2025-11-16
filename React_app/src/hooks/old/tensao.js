import { useMemo } from 'react';
import useMessageStore from '../stores/messageStore';

const useTensaoStore = () => {
  const { parsedMessages, isLoading, error } = useMessageStore();

  const latestTorres = useMemo(() => {
    if (isLoading || error) return [];
    

    // 1. filtra só as mensagens string e com ID de 7 chars
    const valid = parsedMessages
      .filter(m => m.type === 'string')
      .filter(m => {
        const id = m.data.split(';')[0].trim();
        return id.length === 7;
      });

    // 2. reduz pra um objeto { [id]: mensagemMaisRecente }
    const latestById = valid.reduce((acc, m) => {
      const id = m.data.split(';')[0].trim();
      const ts = new Date(m.timestamp);
      if (!acc[id] || ts > new Date(acc[id].timestamp)) {
        acc[id] = m;
      }
      return acc;
    }, {});

    // 3. extrai só os valores após o ID, ordena e achata num array de strings
    const values = Object.keys(latestById)   // → ['222222A', '222222B', …]
      .sort()                               // garante A antes de B
      .flatMap(id =>
        latestById[id]
          .data
          .split(';')                       // ['222222A','130.100','0.009',…]
          .slice(1)                         // ['130.100','0.009',…]
          .map(v => v.trim())               // limpa espaços
      );

    // 4. mapeia cada string para um objeto { torre, tensao, status }
    return values.map((item, index) => {
      const status = item.slice(-1);        // último caractere: 's'
      const tensao = item.slice(0, -1);     // tudo antes: 'aaa.dd'
      return {
        torre: index + 1,                   // índice + 1
        tensao,
        status
      };
    });
  }, [parsedMessages, isLoading, error]);

  return latestTorres;
};

export default useTensaoStore;
