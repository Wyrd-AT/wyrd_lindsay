import { create } from "zustand";
import { localDB, remoteDB } from "./database";

// Fetch all data from the localDB
export const fetchData = async () => {
  try {
    const docs = await localDB.allDocs({ include_docs: true });
    return docs.rows.map((row) => row.doc);
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
      limit: 1000000,
    });
    return result.docs;
  } catch (err) {
    console.error("Error reading data:", err);
    return [];
  }
};

// rotina interna que faz put/post + replicação + atualização de _rev
async function _doSave(doc: any): Promise<{ id: string; rev: string }> {
  // 1) Grava localmente (post → cria um _id; put → atualiza)
  const localRes = doc._id
    ? await localDB.put(doc)
    : await localDB.post(doc);
  const id = localRes.id;

  // 2) Replica somente esse doc para o remoto
  await localDB.replicate.to(remoteDB, {
    doc_ids: [id],
    retry: true,
  });

  // 3) Busca no remoto a versão final (com _rev depois da replicação)
  const remoteDoc = await remoteDB.get(id);

  // 4) Atualiza o local com a _rev do remoto (mantém dados em sincronia)
  await localDB.put(remoteDoc);

  // 5) Retorna o id e a rev definitivos
  return { id: remoteDoc._id, rev: remoteDoc._rev! };
}

/**
 * Grava um documento no localDB e replica no remoto.
 * Se ocorrer conflito de revisão, refaz com a última _rev do local.
 */
export async function saveData(
  doc: any
): Promise<{ id: string; rev: string }> {
  try {
    // primeira tentativa
    return await _doSave(doc);
  } catch (err: any) {
    if (err.status === 409) {
      // conflito: pega a última revisão, faz merge com o novo conteúdo e tenta de novo
      const latest = await localDB.get(doc._id);
      const merged = {
        ...latest,
        ...doc,
        _rev: latest._rev,
      };
      return await _doSave(merged);
    }
    // se não for conflito, propaga o erro
    throw err;
  }
}

export const deleteData = async (data) => {
  try {
    // Se data for doc com _id/_rev
    if (
      typeof data === "object" &&
      data._id &&
      typeof data._id === "string" &&
      data._id.trim() !== ""
    ) {
      await localDB.remove(data);
      return;
    }

    // Se for string id
    if (!data || typeof data !== "string" || data.trim() === "") {
      throw new Error("Invalid ID: must be a non-empty string");
    }

    const doc = await localDB.get(data);
    await localDB.remove(doc);
  } catch (err) {
    console.error("Error deleting data:", err);
  }
};
