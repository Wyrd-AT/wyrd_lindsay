// 2) src/api/database.ts
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import { useSyncStore } from '../stores/syncStore';

PouchDB.plugin(PouchDBFind);

// Banco local e remoto
export const localDB = new PouchDB('lindsay');
export const remoteDB = new PouchDB(
  'https://admin:wyrd@db.vpn.ind.br/mqtt_data',
  { skip_setup: true }
);

// Sincronização bidirecional e ao vivo
localDB
  .sync(remoteDB, { live: true, retry: true })
  .on('change', (info) => {
    console.log('[PouchDB Sync] change', info);
    // Dispara re-render em componentes que usam o hook
    useSyncStore.getState().updateSyncTimestamp();
  })
  .on('paused', (err) => console.log('[PouchDB Sync] paused', err))
  .on('active', () => console.log('[PouchDB Sync] active'))
  .on('denied', (err) => console.error('[PouchDB Sync] denied', err))
  .on('complete', (info) => console.log('[PouchDB Sync] complete', info))
  .on('error', (err) => console.error('[PouchDB Sync] error', err));

// Índices para consultas
export async function configureIndexes() {
  try {
    await localDB.createIndex({ index: { fields: ['topic', 'payload'] } });
    console.log('[Database] índices criados');
  } catch (err) {
    console.error('[Database] erro ao criar índices:', err);
  }
}
configureIndexes();