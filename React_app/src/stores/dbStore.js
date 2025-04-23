// src/stores/dbStore.js
import { localDB } from '../api/database';

const dbStore = {
  // Busca todos os documentos
  fetchData: async () => {
    try {
      const result = await localDB.allDocs({ include_docs: true });
      const docs = result.rows.map(row => row.doc);
      console.log('[dbStore] fetchData encontrou docs:', docs);
      return docs;
    } catch (err) {
      console.error('[dbStore] Erro no fetchData:', err);
      throw err;
    }
  },

  // Busca por query (PouchDB find)
  readData: async (query) => {
    try {
      const result = await localDB.find(query);
      console.log('[dbStore] readData resultado:', result.docs);
      return result.docs;
    } catch (err) {
      console.error('[dbStore] Erro no readData:', err);
      throw err;
    }
  },

  // Atualiza via PUT
  saveData: async (doc) => {
    try {
      const response = await localDB.put(doc);
      console.log('[dbStore] saveData (put):', response);
      return response;
    } catch (err) {
      console.error('[dbStore] Erro no saveData:', err);
      throw err;
    }
  },

  // Insere via POST apenas no localDB
  postData: async (doc) => {
    console.log('[dbStore] postData chamado com doc:', doc);
    try {
      const response = await localDB.post(doc);
      console.log('[dbStore] localDB.post ok:', response);
      return response;
    } catch (err) {
      console.error('[dbStore] ERRO localDB.post:', err);
      throw err;
    }
  },

  // Expondo a instância localDB para uso direto (changes feed, etc)
  localDB,
};

export default dbStore;
