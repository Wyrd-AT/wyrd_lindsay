import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import { useMessageStore } from '../stores/messageStore';  // Reutilizando o `useMessageStore` do outro banco

PouchDB.plugin(PouchDBFind);

// Banco de dados local para 'mtTension'
export const localTensionDB = new PouchDB('mt_tension_data');

// Criação do índice para 'mtTension' (caso precise de indexação por 'timestamp')
const createIndexIfNeeded = async () => {
  try {
    await localTensionDB.createIndex({
      index: {
        fields: ['timestamp', 'type'], // Índice por 'timestamp' e 'type'
      },
    });
    console.log('[Database] Index created for mtTension on timestamp and type.');
  } catch (err) {
    console.error('[Database] Error creating index for mtTension:', err);
  }
};

// Função para carregar os dados de 'mtTension' filtrados por 'machineId' e 'timestamp'
export const loadTensionData = async (machineId, startTime, endTime) => {
  try {
    const selector = {
      type: 'mtTension',
      irrigadorId: machineId,
      timestamp: {
        $gte: startTime,  // Maior ou igual a startTime
        $lte: endTime,    // Menor ou igual a endTime
      },
    };

    const result = await localTensionDB.find({
      selector,
      limit: 1000,               // Limitar os resultados para não sobrecarregar
      sort: [{ timestamp: 'asc' }] // Ordenar por 'timestamp'
    });

    return result.docs || [];
  } catch (err) {
    console.error('[Database] Error loading mtTension data:', err);
    return [];
  }
};

// Função para sincronizar o banco de dados local com o remoto
export const syncTensionData = (remoteDB) => {
  const syncHandlerTension = localTensionDB.sync(remoteDB, {
    live: true,
    retry: true,
    selector: {
      type: { $in: ['mtTension'] },  // Sincroniza apenas dados do tipo 'mtTension'
    },
  })
    .on('active', () => {
      console.log('[Database] Sync active for mtTension');
    })
    .on('paused', () => {
      console.log('[Database] Sync paused for mtTension');
    })
    .on('error', (err) => {
      console.error('[Database] Sync error for mtTension:', err);
    })
    .on('change', (change) => {
      console.log('[Database] Sync change for mtTension:', change);
    });

  return syncHandlerTension;
};

// Chama a criação do índice ao inicializar o banco
createIndexIfNeeded();
