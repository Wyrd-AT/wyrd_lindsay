import { create } from 'zustand';

export const useMessageStore = create((set, get) => ({
  // Map interno de _id → mensagem
  messagesMap: new Map(),
  // Array derivado de mensagens válidas
  parsedMessages: [],

  // Upsert de uma mensagem parseada
  upsertMessage: (id, msgObj) => {
    const map = new Map(get().messagesMap);
    map.set(id, msgObj);
    const list = Array.from(map.values()).filter(m =>
      ['event', 'mtTension', 'command', 'monitorStatus'].includes(m.type)
    );
    set({ messagesMap: map, parsedMessages: list });
  }
}));