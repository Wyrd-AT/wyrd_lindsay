// src/hooks/useParsedMessages.js
import { useEffect } from 'react';
import dbStore from '../stores/dbStore';
import { useMessageStore } from '../stores/messageStore';

export function useParsedMessages() {
  const parsedMessages = useMessageStore(state => state.parsedMessages);

  useEffect(() => {
    let cancelled = false;
    const changes = dbStore.localDB
      .changes({ since: 0, live: true, include_docs: true })
      .on('change', change => {
        if (cancelled) return;
        const doc = change.doc;
        if (!doc || doc._id.startsWith('_design/') || !doc.type) return;
        const tipos = ['mtTension','monitorStatus','event','command'];
        if (!tipos.includes(doc.type)) return;
        const base = {
          type: doc.type,
          irrigadorId: doc.irrigadorId,
          timestamp: new Date(doc.timestamp),
          origin: doc.origin,
        };
        let msgObj;
        switch (doc.type) {
          case 'mtTension':
            msgObj = { ...base, mtReadings: doc.mtReadings };
            break;
          case 'monitorStatus':
            msgObj = { ...base, status: doc.status };
            break;
          case 'event':
            msgObj = {
              ...base,
              eventType: doc.eventType,
              eventCode: doc.eventCode,
            };
            break;
          case 'command':
            msgObj = { ...base, command: doc.command };
            break;
        }
        useMessageStore.getState().upsertMessage(doc._id, msgObj);
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
