import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import { useMessageStore } from '../stores/messageStore';

PouchDB.plugin(PouchDBFind);

// Database connections
export const localDB = new PouchDB('lindsay');
export const remoteDB = new PouchDB('https://admin:wyrd@db.vpn.ind.br/mqtt_data', { skip_setup: true });

console.log('[Database] Starting sync...');

// Start sync
const syncHandler = localDB.sync(remoteDB, {
  live: true,
  retry: true,
  selector: {
    type: { $in: ['event', 'monitorStatus', 'command'] }
  }
})
.on('active', () => {
  console.log('[Database] Sync active');
  useMessageStore.getState().updateSyncStatus({ isSyncing: true, docCountDiff: 0 });
})
.on('paused', () => {
  console.log('[Database] Sync paused');
  useMessageStore.getState().updateSyncStatus({ isSyncing: false, docCountDiff: 0 });
})
.on('error', (err) => {
  console.error('[Database] Sync error:', err);
  useMessageStore.getState().updateSyncStatus({ isSyncing: false, docCountDiff: 0 });
})
.on('change', (change) => {
  console.log('[Database] Sync change:', change);
  // Update docCountDiff based on changes
  const docCountDiff = change.direction === 'pull' ? change.change.docs.length : -change.change.docs.length;
  useMessageStore.getState().updateSyncStatus({ 
    isSyncing: true, 
    docCountDiff: useMessageStore.getState().syncStatus.docCountDiff + docCountDiff 
  });
});

// Export sync handler for potential cleanup
export const sync = syncHandler;

