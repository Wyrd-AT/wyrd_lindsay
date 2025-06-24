import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import { getSyncActiveCount, incrementSyncActiveCount, decrementSyncActiveCount } from '../stores/syncCounterStore';

PouchDB.plugin(PouchDBFind);

// Database connections
export const localDB = new PouchDB('lindsay');
export const localDB2 = new PouchDB('lindsay2');
export const remoteDB = new PouchDB('https://admin:wyrd@db.vpn.ind.br/mqtt_data', { skip_setup: true });

console.log('[Database] Ready for manual sync and changes management.');

// Callable function to start localDB.changes listener
export function startLocalDBChanges(onChange, onError) {
  return localDB.changes({
    since: 'now',
    live: true,
    include_docs: true
  })
  .on('change', onChange || (() => {}))
  .on('error', onError || ((err) => { console.error('[Database] Changes feed error:', err); }));
}

// Callable function for batch sync
export function batchSync() {
  const startTime = new Date();
  console.log('[Database] Sync start time:', startTime.toISOString());
  return remoteDB.allDocs({ include_docs: true }).then((result) => {
    const endTime = new Date();
    console.log('[Database] Sync end time:', endTime.toISOString());
    console.log('[Database] Result length:', result.rows ? result.rows.length : 0);
    return result;
  });
}

// Callable function to start live sync
export function startSyncHandler() {
  console.log('[Database] Starting sync, counter:', getSyncActiveCount());
  return localDB.sync(remoteDB, {
    live: true,
    retry: true,
    batch_size: 5000, 
    selector: {
      type: { $in: ['event', 'monitorStatus', 'command'] }
    }
  })
  .on('paused', (info) => {
    decrementSyncActiveCount();
    console.log('[database.ts] Sync paused, counter:', getSyncActiveCount());
  })
  .on('error', ((err) => { console.error('[Database] Sync error:', err); }));
}

// Export sync handler for potential cleanup
export const sync = startSyncHandler;

