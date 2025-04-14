// stores/dbStore.js
import { localDB } from '../api/database';

const dbStore = {
  // Função para ler dados com base em um query (ex.: { selector: { clientId: '123' } })
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

  // Função para salvar (ou atualizar) um documento
  async saveData(doc) {
    try {
      const response = await localDB.put(doc);
      console.log("Documento salvo:", response);
      return response;
    } catch (err) {
      console.error("Erro ao salvar documento:", err);
      throw err;
    }
  }
};

export default dbStore;
