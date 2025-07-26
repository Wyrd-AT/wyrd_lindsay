import { create } from 'zustand';
import { localDB } from '../api/database';

export const parseMessage = (doc) => {
  if (!doc || doc._id.startsWith('_design/') || !doc.type) return null;
  const tipos = ['mqtt_messages', 'command'];
  if (!tipos.includes(doc.table)) return null;

  const base = {
    _id: doc._id,
    _rev: doc._rev,
    topic: doc.topic,
    type: doc.type,
    origin: doc.origin,
    table: doc.table,
    data: doc.data,
    timestamp: doc.timestamp || new Date().toISOString(),
  };

  let msgObj = { ...base };
  // switch (doc.type) {
  //   case 'mtTension':
  //     msgObj = { ...base, mtReadings: doc.mtReadings };
  //     break;
  //   case 'monitorStatus':
  //     msgObj = { ...base, status: doc.status };
  //     break;
  //   case 'event':
  //     msgObj = {
  //       ...base,
  //       eventType: doc.eventType,
  //       eventCode: doc.eventCode,
  //     };
  //     break;
  //   case 'command':
  //     msgObj = { ...base, command: doc.command };
  //     break;
  //   default:
  //     return null;
  // }
  return msgObj;
};

// Load initial messages from PouchDB
const loadInitialMessages = async () => {
  try {
    //////console.log('[messageStore] loadInitialMessages');
    const result = await localDB.allDocs({ include_docs: true });
    ////////console.log('[messageStore] loadInitialMessages result', result);

    const messagesMap = new Map();
    ////////console.log('[messageStore] result', result, result.rows.length);
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
  messagesMap: new Map(),
  parsedMessages: [],
  isLoading: true,
  error: null,


  initialize: async () => {
    try {
      //////console.log('[messageStore] initialize called');
      const { messagesMap, parsedMessages } = await loadInitialMessages();
      //////console.log(messagesMap)
      //////console.log(messagesMap)

      set({
        messagesMap,
        parsedMessages,
        isLoading: false
      });
      //////console.log('[messageStore] initialize finished, loaded', parsedMessages.length, 'messages');
      if (!get()._changesFeed) {
        const changesFeed = localDB.changes({
          since: 'now',
          live: true,

          include_docs: true

        })
          .on('change', (change) => {
            if (change.doc && !change.doc._id.startsWith('_design/')) {
              const msgObj = parseMessage(change.doc);
              if (msgObj) {
                set((state) => {
                  const map = new Map(state.messagesMap);
                  map.set(change.doc._id, msgObj);
                  const list = Array.from(map.values()).filter(m =>
                    ['mqtt_messages', 'command'].includes(m.table)
                  );
                  //////console.log(list)
                  return { messagesMap: map, parsedMessages: list };
                });
              }
            }
          })
          .on('error', (err) => {
            console.error('[messageStore] Changes feed error:', err);
          });
        set({ _changesFeed: changesFeed });
      }
    } catch (err) {
      console.error('[messageStore] initialize error', err);
      set({
        error: err.message,
        isLoading: false
      });
    }
  },

  upsertMessage: (id, msgObj) => {
    const map = new Map(get().messagesMap);
    map.set(id, msgObj);
    const list = Array.from(map.values()).filter(m =>
      ['mqtt_messages', 'command'].includes(m.table)
    );
    set({ messagesMap: map, parsedMessages: list });
  },

  postMessage: async (doc) => {
    try {
      const response = await localDB.post(doc);
      const msgObj = parseMessage({ ...doc, _id: response.id });
      if (msgObj) get().upsertMessage(response.id, msgObj);
      return response;
    } catch (err) {
      console.error('[messageStore] ERRO localDB.post:', err);
      throw err;
    }
  },
  saveMessage: async (doc) => {
    try {
      const response = await localDB.put(doc);
      const msgObj = parseMessage(doc);
      if (msgObj) get().upsertMessage(doc._id, msgObj);
      return response;
    } catch (err) {
      console.error('[messageStore] Erro no saveMessage:', err);
      throw err;
    }
  },
  fetchMessages: async () => {
    try {
      const result = await localDB.allDocs({ include_docs: true });
      return result.rows.map(row => row.doc);
    } catch (err) {
      console.error('[messageStore] Erro no fetchMessages:', err);
      throw err;
    }
  },
  readMessages: async (query) => {
    try {
      const result = await localDB.find(query);
      return result.docs;
    } catch (err) {
      console.error('[messageStore] Erro no readMessages:', err);
      throw err;
    }
  },

  clearMessages: () => {
    set({ messagesMap: new Map(), parsedMessages: [] });
  }
}));

export default useMessageStore;