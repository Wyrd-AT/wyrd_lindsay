// src/hooks/useVetorSw.js
import { useEffect, useMemo } from 'react';
import useMessageStore from '../stores/messageStore';

const STATUS_MAP = {
  '0': 'OK',
  '1': 'Alarmado',
  '2': 'Reconhecido',
  '3': 'Resolvido',
  '9': 'Ausente',
};

// utilitário para parsear um vetor SW
export function parseSwVector(raw) {
  const [irrigador, date, ...header] = raw.split(';');
  //console.log(irrigador)
  // paineis: dois primeiros itens de 2 dígitos
  const paineis = header.slice(0, 2);
  //console.log(paineis)
  const torres =  header.slice(2,3)
  const monitores = header.slice(3);

  const paineisInfo = paineis.map(p => {
    //console.log(p)
    const [p1,p2] = p.split(';');
    return { statusAlarmeP1: STATUS_MAP[p1], statusAlarmeP2: STATUS_MAP[p2]};
  });

  const torreInfo = torres.map(t =>{
    const [t1,t2] = t.split('')
    return { statusTorre1: STATUS_MAP[t1], statusTorre2: STATUS_MAP[t2]};

  }
  )

  const monitoresInfo = monitores.map(m => {
    const [s1, s2, arm, tens] = m.split('');
    return {
      statusSw1:   STATUS_MAP[s1],
      statusSw2:   STATUS_MAP[s2],
      armadilhaTensao: arm,
      statusTensaoCodigo: tens,
      statusTensao: STATUS_MAP[tens],
    };
  });

  const totalAlarmadoPainel = paineisInfo.reduce((sum, {statusAlarmeP1, statusAlarmeP2}) =>
    sum + (statusAlarmeP1 === 'Alarmado'?1:0) + (statusAlarmeP2 === 'Alarmado'?1:0)
  , 0);

  const totalAlarmadoTorre = torreInfo.reduce((sum, {statusTorre1, statusTorre2}) =>
    sum + (statusTorre1 === 'Alarmado'?1:0) + (statusTorre2 === 'Alarmado'?1:0)
  , 0);

  const totalAlarmadoMonitor = monitoresInfo.reduce((sum, {statusSw1, statusSw2, statusTensao}) =>
    sum + (statusSw1 === 'Alarmado'?1:0)
        + (statusSw2 === 'Alarmado'?1:0)
        + (statusTensao === 'Alarmado'?1:0)
  , 0);

  return {
    irrigador,
    date,
    paineisInfo,
    monitoresInfo,
    totalAlarmado: totalAlarmadoPainel + totalAlarmadoMonitor,
  };
}

export default function useVetorSw(irrigadorIds = []) {
  const { parsedMessages = [], isLoading, error, initialize } = useMessageStore();
//console.log(parsedMessages)
  useEffect(() => {
    initialize();
  }, [initialize]);

  return useMemo(() => {
    if (isLoading || error) {
      return irrigadorIds.reduce((acc, id) => {
        acc[id] = { vectorsSW: [], latestSW: null };
        return acc;
      }, {});
    }

    // filtra todos os raw vectors válidos (tipo string, >8 campos) cujo irrigador está na lista
    const raws = parsedMessages
      .filter(m => m.type === 'string')
      .map(m => m.data)
      .filter(d => {
        const parts = d.split(';');
        return parts.length == 19 && irrigadorIds.includes(parts[0]);
      });
    //console.log(raws)
    // agrupa por irrigador
    const grouped = raws.reduce((acc, raw) => {
      const id = raw.split(';')[0];
      if (!acc[id]) acc[id] = new Set();
      acc[id].add(raw);
      return acc;
    }, {});

    // monta resultado final
    const result = {};
    irrigadorIds.forEach(id => {
      const setRaw = grouped[id] || new Set();
      const vectors = Array.from(setRaw);
      // escolhe o mais recente pelo segundo campo
      const latest = vectors.length
        ? vectors.reduce((p, c) => {
            return new Date(p.split(';')[1]) > new Date(c.split(';')[1]) ? p : c;
          })
        : null;
      result[id] = { vectorsSW: vectors, latestSW: latest };
    });

    return result;
  }, [parsedMessages, isLoading, error, irrigadorIds]);
}
