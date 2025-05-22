// src/hooks/useParsedMessages.js
import { useEffect } from 'react';
import dbStore from '../stores/dbStore';
import { parseMessage } from '../utils/messageParser';
import { useMessageStore } from '../stores/messageStore';

export function useParsedMessages() {
  // Lê array reativo do store
  const parsedMessages = useMessageStore(state => state.parsedMessages);

  useEffect(() => {
    let cancelled = false;
    const { localDB } = dbStore;

    const changes = localDB.changes({ since: 0, live: true, include_docs: true })
      .on('change', change => {
        if (cancelled) return;
        const doc = change.doc;
        if (!doc || doc._id.startsWith('_design/') || typeof doc.payload !== 'string') return;
        try {
          const parsed = parseMessage(doc.payload);
          const msgObj = { ...parsed, timestamp: parsed.timestamp, origin: doc.origin };
          // injeta no Zustand
          useMessageStore.getState().upsertMessage(doc._id, msgObj);
        } catch {
          // ignora mensagens inválidas
        }
      })
      .on('error', err => console.error('[useParsedMessages] changes error:', err));

    return () => {
      cancelled = true;
      changes.cancel();
    };
  }, []);

  return parsedMessages;
}
export default useParsedMessages;
