import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import { getSyncActiveCount, incrementSyncActiveCount, decrementSyncActiveCount } from '../stores/syncCounterStore';

PouchDB.plugin(PouchDBFind);

// Database connections
export const localDB = new PouchDB('lindsay');
export const remoteDB = new PouchDB('https://admin:wyrd@db.vpn.ind.br/mqtt_data', { skip_setup: true });

//////console.log('[Database] Ready for manual sync and changes management.');

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
  //console.log('[Database] Sync start time:', startTime.toISOString());
  return remoteDB.allDocs({ include_docs: true }).then((result) => {
    const endTime = new Date();
    //console.log('[Database] Sync end time:', endTime.toISOString());
    //console.log('[Database] Result length:', result.rows ? result.rows.length : 0);
    return result;
  });
}

// Callable function to start live sync
export function startSyncHandler() {
  //console.log('[Database] Starting sync, counter:', getSyncActiveCount());
  return localDB.sync(remoteDB, {
    live: true,
    retry: true,
    batch_size: 50000, 
    selector: {
      table: { $in: ['mqtt_messages','irrigadores','command'] }
    }
  })
  .on('paused', (info) => {
    decrementSyncActiveCount();
    //console.log('[database.ts] Sync paused, counter:', getSyncActiveCount());
  })
  .on('error', ((err) => { console.error('[Database] Sync error:', err); }));
}

// Export sync handler for potential cleanup
export const sync = startSyncHandler;

export async function saveData(doc: any) {
  try {
    // 1) salva localmente
    const localResult = await localDB.put(doc);
    //console.log('[Database] Salvo localmente:', localResult);

    // 2) prepara doc para enviar ao remoto
    //    usamos o _id retornado (se não houver _id original, o PouchDB gerou um)
    const remoteDoc: any = {
      ...doc,
      _id: localResult.id
    };
    // removemos _rev local para evitar conflito de revisão no remoto
    delete remoteDoc._rev;

    // 3) salva remotamente
    const remoteResult = await remoteDB.put(remoteDoc);
    //console.log('[Database] Salvo no CouchDB remoto:', remoteResult);

    return { localResult, remoteResult };
  } catch (error) {
    console.error('[Database] Erro ao salvar dados:', error);
    throw error;
  }
}

export async function updateData(_id, updatedFields) {
  try {
    const existingDoc = await localDB.get(_id);
    const updatedDoc = {
      ...existingDoc,
      ...updatedFields,
      _id: existingDoc._id,
      _rev: existingDoc._rev,
    };

    const result = await localDB.put(updatedDoc);

    // Forçar uma replicação one‑off após o put
    try {
      const info = await localDB.replicate.to(remoteDB);
      console.log('[Database] One‑off push para remoteDB completo:', info);
    } catch (syncErr) {
      console.error('[Database] Erro no one‑off push para remoteDB:', syncErr);
    }

    return result;
  } catch (err) {
    console.error('[Database] Erro ao atualizar documento:', err);
    throw err;
  }
}