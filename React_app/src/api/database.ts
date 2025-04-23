// src/api/database.ts
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);

// 1) Banco local (IndexedDB no navegador)
export const localDB = new PouchDB('lindsay');

// 2) Banco remoto (CouchDB em HTTPS)
//    - skip_setup impede tentativa de criar o DB remoto se ele já existir
export const remoteDB = new PouchDB(
  'https://admin:wyrd@db.vpn.ind.br/mqtt_data',
  { skip_setup: true }
);

// 3) Sincronização bidirecional e ao vivo
localDB
  .sync(remoteDB, { live: true, retry: true })
  .on('change', info => {
    console.log('[PouchDB Sync] change', info);
  })
  .on('paused', err => {
    console.log('[PouchDB Sync] paused (offline ou sem mudanças)', err);
  })
  .on('active', () => {
    console.log('[PouchDB Sync] retomada');
  })
  .on('denied', err => {
    console.error('[PouchDB Sync] acesso negado:', err);
  })
  .on('complete', info => {
    console.log('[PouchDB Sync] completa', info);
  })
  .on('error', err => {
    console.error('[PouchDB Sync] erro geral:', err);
  });

// 4) Índices necessários para consultas rápidas
export async function configureIndexes() {
  try {
    await localDB.createIndex({
      index: { fields: ['topic', 'payload'] }
    });
    console.log('[Database] índices criados');
  } catch (err) {
    console.error('[Database] erro ao criar índices:', err);
  }
}

// 5) Invoca a criação de índices na inicialização
configureIndexes();
