// utils/messageParser.js
/**
 * parseMessage decodifica payloads do irrigador, garantindo timestamp consistente.
 */
export function parseMessage(message) {
  const parts = message.trim().split(';');
  if (parts.length < 2) {
    throw new Error('Formato inválido: menos de duas partes');
  }

  const irrigadorId = parts[0];
  const rawTs = parts[1];
  // Converte 'YYYY-MM-DD HH:mm:ss' em objeto Date
  const isoTimestamp = rawTs.replace(' ', 'T');
  const timestamp = new Date(isoTimestamp);
  if (isNaN(timestamp.getTime())) {
    throw new Error(`Timestamp inválido: ${rawTs}`);
  }

  // Mapa de status para monitorStatus
  const statusMap = {
    '0': 'OK',
    '1': 'Alarmado',
    '2': 'Alarmado Recon',
    '3': 'Desconhecido',
    '4': 'Desconhecido',
    '5': 'Desconhecido',
    '6': 'Desconhecido',
    '7': 'Desconhecido',
    '8': 'Desconhecido',
    '9': 'Desconhecido',
  };

  // 1) monitorStatus: ID;ts;d1;d2;...
  if (parts.length >= 3 && parts.slice(2).every(v => /^[0-9]$/.test(v))) {
    const status = parts.slice(2).map((v, i) => ({
      mt: i + 1,
      status: statusMap[v] || 'Desconhecido',
    }));
    return { type: 'monitorStatus', irrigadorId, timestamp, status };
  }

  // 2) event/alarme: ID;ts;A123 ou E123
  if (parts.length === 3 && /^[AE]\d+$/.test(parts[2])) {
    const ev = parts[2];
    return {
      type: 'event',
      irrigadorId,
      timestamp,
      eventType: ev.charAt(0) === 'A' ? 'alarme' : 'evento',
      eventCode: ev.slice(1),
    };
  }

  // 3) command simples: ID;COMANDO
  if (parts.length === 2 && /^[A-Za-z]+$/.test(parts[1])) {
    return {
      type: 'command',
      irrigadorId,
      command: parts[1].replace(/'/g, ''),
      timestamp, // usa o timestamp convertido
    };
  }

  // 4) mtTension: ID;ts;volt1S;volt2S;...
  if (parts.length >= 3) {
    const mtReadings = parts.slice(2).map((str, i) => {
      const m = str.match(/^(\d+\.\d{2})([01])$/);
      if (m) {
        return {
          mt: i + 1,
          voltage: parseFloat(m[1]),
          status: m[2] === '0' ? 'ON' : 'OFF',
        };
      }
      return { mt: i + 1, voltage: parseFloat(str) || 0, status: '–' };
    });
    return {
      type: 'mtTension',
      irrigadorId,
      timestamp,
      mtReadings,
    };
  }

  throw new Error('Formato não reconhecido: ' + message);
}
