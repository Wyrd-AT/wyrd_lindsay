// utils/messageParser.js
export function parseMessage(message) {
    const parts = message.split(';');
  
    if (parts.length < 2) {
      throw new Error('Mensagem com formato inválido');
    }
  
    const irrigadorId = parts[0];
    
    if (parts.length === 8 && parts.slice(1).every(y => !isNaN(parseFloat(y)))) {
      const statusValues = parts.slice(1).map(val => Number(val));
      return {
        type: 'monitorStatus',
        irrigadorId,
        status: statusValues
      };
    }
    
    if (parts[1].includes('-') && parts[1].includes(':') && parts.length === 3) {
      const datetime = parts[1];
      const eventField = parts[2];
      const eventType = eventField.charAt(0) === 'A' ? 'alarme' : 'evento';
      const eventCode = eventField.slice(1);
      return {
        type: 'event',
        irrigadorId,
        datetime,
        eventType,
        eventCode
      };
    }
    
    if (parts.length === 2 && /^[A-Za-z]+$/.test(parts[1])) {
      const command = parts[1].replace(/'/g, "");
      return {
        type: 'command',
        irrigadorId,
        command
      };
    }
    
    if (parts.length >= 2) {
      const mtReadings = parts.slice(1).map((str, index) => {
        const regex = /^(\d{3},\d{2})(\d)$/;
        const match = str.match(regex);
        if (match) {
          const voltage = match[1];
          const status = match[2] === '1' ? 'ON' : 'OFF';
          return { mt: index + 1, voltage, status };
        } else {
          return { mt: index + 1, value: str };
        }
      });
      return {
        type: 'mtTension',
        irrigadorId,
        mtReadings
      };
    }
    
    throw new Error('Formato de mensagem não reconhecido');
  }
  