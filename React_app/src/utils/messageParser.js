// utils/messageParser.js
export function parseMessage(message) {
  const parts = message.split(';');
  if (parts.length < 2) throw new Error('Formato inválido');

  const irrigadorId = parts[0];
  const rawTs = parts[1];
  const isoTimestamp = rawTs.replace(' ', 'T');

  // Map de status de monitorStatus
  const statusMap = {
    '0': 'OK',
    '1': 'Alarmado',
    '2': 'Alarme Resolvido',
    '3': 'Pendente',
    '4': 'Off',
    '5': 'Manutenção',
    '6': 'Erro de Configuração',
    '7': 'Sobrecarga',
    '8': 'Desconhecido',
    '9': 'Desativado',
  };

  // 1) monitorStatus: ID;ts;d1;d2;... (cada di é 0–9)
  if (
    parts.length >= 3 &&
    parts.slice(2).every(v => /^[0-9]$/.test(v))
  ) {
    const status = parts.slice(2).map((v, i) => ({
      mt: i + 1,
      status: statusMap[v] || 'Desconhecido'
    }));
    return { type: 'monitorStatus', irrigadorId, timestamp: isoTimestamp, status };
  }

  // 2) event/alarme: ID;YYYY-MM-DD HH:MM:SS;A123 ou E123
  if (
    parts.length === 3 &&
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(rawTs)
  ) {
    const ev = parts[2];
    return {
      type: 'event',
      irrigadorId,
      datetime: isoTimestamp,
      eventType: ev.charAt(0) === 'A' ? 'alarme' : 'evento',
      eventCode: ev.slice(1)
    };
  }

  // 3) comando simples: ID;comando
  if (parts.length === 2 && /^[A-Za-z]+$/.test(parts[1])) {
    return {
      type: 'command',
      irrigadorId,
      command: parts[1].replace(/'/g, ''),
      timestamp: new Date().toISOString()
    };
  }

  // 4) mtTension: ID;ts;volt1S;volt2S;... (cada volt é xxx.xxx[y], y=0/1 de status)
  if (parts.length >= 3) {
    const mtReadings = parts.slice(2).map((str, i) => {
      // ex: "463.4001" => ["463.400", "1"]
      const m = str.match(/^(\d+\.\d{2})([01])$/);
      if (m) {
        return {
          mt: i + 1,
          voltage: m[1],            // string exata "463.400"
          status: m[2] === '1' ? 'ON' : 'OFF'
        };
      }
      // fallback genérico
      return { mt: i + 1, voltage: str, status: '–' };
    });
    return {
      type: 'mtTension',
      irrigadorId,
      timestamp: isoTimestamp,
      mtReadings
    };
  }

  throw new Error('Formato não reconhecido');
}
