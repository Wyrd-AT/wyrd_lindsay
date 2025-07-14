import { create } from "zustand";
import { localDB, remoteDB } from "./database";

// Fetch all data from the localDB
const fetchData = async () => {
  try {
    const docs = await localDB.allDocs({ include_docs: true });
    return docs.rows.map((row) => row.doc); // Return only the 'doc' field from each object
  } catch (error) {
    console.error("Error fetching data:", error);
    return [];
  }
};

// Read data with a selector
export const readData = async (params) => {
  if (!Array.isArray(params)) {
    params = [params];
  }
  try {
    const result = await localDB.find({
      selector: { $or: params },
      limit: 1000000 ,
    });
    return result.docs;
  } catch (err) {
    console.error("Error reading data:", err);
    return [];
  }
};

export async function saveData(doc: any): Promise<{ id: string; rev: string }> {
  // 1) Grava localmente (post → cria um _id; put → atualiza)
  let localRes
  if (doc._id) {
    localRes = await localDB.put(doc)
  } else {
    localRes = await localDB.post(doc)
  }
  const id = localRes.id

  // 2) Replica somente esse doc para o remoto
  await localDB.replicate.to(remoteDB, {
    doc_ids: [id],
    retry: true
  })

  // 3) Busca no remoto a versão final (com _rev depois da replicação)
  const remoteDoc = await remoteDB.get(id)

  // 4) Atualiza o local com a _rev do remoto (mantém tudo igual)
  await localDB.put(remoteDoc)

  // 5) Retorna o id e a rev definitivos
  return { id: remoteDoc._id, rev: remoteDoc._rev! }
}


export const deleteData = async (data) => {
  try {
    //////console.log("deleteData => recebido:", data);
    
    // Se data for um objeto com _id, utilize-o diretamente (supondo que _rev também esteja presente)
    if (typeof data === "object" && data._id && typeof data._id === "string" && data._id.trim() !== "") {
      await localDB.remove(data);
      //////console.log("Documento deletado:", data);
      return;
    }
    
    // Se data for uma string, proceda buscando o documento
    if (!data || typeof data !== "string" || data.trim() === "") {
      throw new Error("Invalid ID: must be a non-empty string");
    }
    
    const doc = await localDB.get(data);
    await localDB.remove(doc);
    //////console.log("Documento deletado:", doc);
  } catch (err) {
    console.error("Error deleting data:", err);
  }
};

