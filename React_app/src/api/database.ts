import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import { getSyncActiveCount, incrementSyncActiveCount, decrementSyncActiveCount } from '../stores/syncCounterStore';

PouchDB.plugin(PouchDBFind);

// Database connections
export const localDB = new PouchDB('lindsay');
//export const remoteDB = new PouchDB('https://admin:wyrd@db.vpn.ind.br/mqtt_data', { skip_setup: true });
export const remoteDB = new PouchDB('http://admin:wyrd@54.211.31.145:5984/mqtt_data', { skip_setup: true });

////////console.log('[Database] Ready for manual sync and changes management.');

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
  incrementSyncActiveCount();
  console.log('[Database] Starting sync, counter:', getSyncActiveCount());
  return localDB.sync(remoteDB, {
    live: true,
    retry: true,
    batch_size: 100000, 
    selector: {
      table: { $in: ['mqtt_messages','irrigadores','command'] }
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

export async function saveData(doc: any) {
  try {
    // 1) salva localmente
    const localResult = await localDB.put(doc);
    ////console.log('[Database] Salvo localmente:', localResult);

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
    ////console.log('[Database] Salvo no CouchDB remoto:', remoteResult);

    return { localResult, remoteResult };
  } catch (error) {
    console.error('[Database] Erro ao salvar dados:', error);
    throw error;
  }
}

export async function updateData(
  _id: string,
  updatedFields: Record<string, any>,
  maxRetries = 3
): Promise<PouchDB.Core.Response> {
  // 0) Puxa mudanças remotas → local
  try {
    await localDB.replicate.from(remoteDB);
  } catch (pullErr) {
    console.warn('[Database] Falha ao puxar mudanças antes do update:', pullErr);
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 1) Busca a última versão do doc
      const existing = await localDB.get(_id);

      // 2) Mescla campos
      const toSave = { ...existing, ...updatedFields };

      // 3) Tenta gravar
      const result = await localDB.put(toSave);

      // 4) One‑off push para remoto (não bloqueante)
      localDB.replicate
        .to(remoteDB)
        .catch(syncErr => console.error('[Database] Erro no push após update:', syncErr));

      return result;
    } catch (err: any) {
      if (err.status === 409) {
        console.warn(
          `[Database] Conflito detectado (tentativa ${attempt}/${maxRetries}), retry em ${100 *
            2 ** attempt}ms…`
        );
        // back‑off exponencial
        await new Promise(res => setTimeout(res, 100 * 2 ** attempt));
        continue;
      }
      // se não for 409, propaga
      throw err;
    }
  }

  // 5) Última tentativa “forçada”: fetch + merge final
  const latest = await localDB.get(_id);
  const finalMerge = { ...latest, ...updatedFields };
  const finalResult = await localDB.put(finalMerge);
  await localDB.replicate
    .to(remoteDB)
    .catch(syncErr => console.error('[Database] Erro no push final após update:', syncErr));
  return finalResult;
}

async function replicateOneOff(): Promise<void> {
  try {
    const info = await localDB.replicate.to(remoteDB);
    //console.log('[Database] One‑off push para remoteDB completo:', info);
  } catch (syncErr) {
    console.error('[Database] Erro no one‑off push para remoteDB:', syncErr);
  }
}
