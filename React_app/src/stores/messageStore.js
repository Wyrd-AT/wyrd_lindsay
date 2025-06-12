import { create } from 'zustand';
import dbStore from './dbStore';
import { localDB } from '../api/database';

export const parseMessage = (doc) => {
  if (!doc || doc._id.startsWith('_design/') || !doc.type) return null;
  const tipos = ['mtTension', 'monitorStatus', 'event', 'command', 'log'];
  if (!tipos.includes(doc.type)) return null;

  const base = {
    _id: doc._id,
    type: doc.type,
    // irrigadorId: doc.irrigadorId,
    timestamp: new Date(doc.timestamp),
    // origin: doc.origin,
  };

  let msgObj;
  switch (doc.type) {
    case 'mtTension':
      msgObj = { ...base, mtReadings: doc.mtReadings, irrigadorId: doc.irrigadorId, origin: doc.origin };
      break;
    case 'monitorStatus':
      msgObj = { ...base, status: doc.status, irrigadorId: doc.irrigadorId, origin: doc.origin };
      break;
    case 'event':
      msgObj = {
        ...base,
        eventType: doc.eventType,
        eventCode: doc.eventCode,
        status: doc.status,
        description: doc.description,
        notifications: doc.notifications,
        responsible: doc.responsible,
        irrigadorId: doc.irrigadorId,
        origin: doc.origin
      };
      break;
    case 'log':
      msgObj = {
        ...base,
        alert_id: doc.alert_id,
        responsible: doc.responsible,
        action: doc.action

      };
      break;
    case 'command':
      msgObj = { ...base, command: doc.command, irrigadorId: doc.irrigadorId, origin: doc.origin };
      break;
    default:
      return null;
  }
  return msgObj;
};

// Load initial messages from PouchDB
const loadInitialMessages = async () => {
  try {
    console.log('[messageStore] loadInitialMessages');
    const result = await localDB.allDocs({ include_docs: true });
    const messagesMap = new Map();
    console.log('[messageStore] result', result, result.rows.length);
    result.rows.forEach(row => {
      const msgObj = parseMessage(row.doc);
      if (msgObj) {
        messagesMap.set(row.doc._id, msgObj);
      }
    });

    return { 
      messagesMap, 
      parsedMessages: Array.from(messagesMap.values())
    };
  } catch (err) {
    console.error('[messageStore] Error loading initial messages:', err);
    throw err;
  }
};

export const useMessageStore = create((set, get) => ({
  // Map interno de _id → mensagem
  messagesMap: new Map(),
  // Array derivado de mensagens válidas
  parsedMessages: [],
  isLoading: true, // Start as loading
  error: null,
  // Add sync status state
  syncStatus: {
    isSyncing: false,
    docCountDiff: 0
  },

  // Update sync status
  updateSyncStatus: (status) => {
    set({ syncStatus: status });
    // Update isLoading based on sync status
    const { isSyncing, docCountDiff } = status;
    set({ isLoading: isSyncing || docCountDiff > 0 });
  },

  // Initialize store with messages
  initialize: async () => {
    try {
      const { messagesMap, parsedMessages } = await loadInitialMessages();
      set({ 
        messagesMap, 
        parsedMessages,
        // Don't set isLoading to false here - it will be controlled by sync status
      });
    } catch (err) {
      set({ 
        error: err.message,
        isLoading: false 
      });
    }
  },

  // Upsert de uma mensagem parseada
  upsertMessage: (id, msgObj) => {
    const map = new Map(get().messagesMap);
    map.set(id, msgObj);
    const list = Array.from(map.values()).filter(m =>
      ['event', 'mtTension', 'command', 'monitorStatus'].includes(m.type)
    );
    set({ messagesMap: map, parsedMessages: list });
  },

  // Clear all messages
  clearMessages: () => {
    set({ messagesMap: new Map(), parsedMessages: [] });
  }
}));

// Initialize the store immediately
useMessageStore.getState().initialize();

export default useMessageStore;