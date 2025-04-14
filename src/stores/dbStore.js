// stores/dbStore.js
import { localDB, configureReplication } from '../api/database';

configureReplication();

const dbStore = {
  // Método que usa o 'find' para leitura
  async readData(query) {
    try {
      const result = await localDB.find(query);
      console.log("Dados lidos:", result.docs);
      return result.docs;
    } catch (err) {
      console.error("Erro ao ler dados:", err);
      throw err;
    }
  },

  // Método usando put (requere _id manual)
  async saveData(doc) {
    try {
      const response = await localDB.put(doc);
      console.log("Documento salvo (put):", response);
      return response;
    } catch (err) {
      console.error("Erro ao salvar documento:", err);
      throw err;
    }
  },

  // Novo método usando post (gera _id automaticamente)
  async postData(doc) {
    try {
      const response = await localDB.post(doc);
      console.log("Documento salvo (post):", response);
      return response;
    } catch (err) {
      console.error("Erro ao salvar documento via post:", err);
      throw err;
    }
  }
};

export default dbStore;
