// couch.js (ESM)
// Requer Node 16+ com "type": "module" no package.json

import axios from "axios";

/* ---- Axios instance ---- */
export const couch = axios.create({
  baseURL: "https://admin:wyrd@db.vpn.ind.br",
  auth: {
    username: "admin",
    password: "wyrd"
  },
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
  // Deixe Axios entregar respostas 4xx/5xx pra tratarmos nós mesmos
  validateStatus: s => s >= 200 && s < 600
});



/* ---- Helpers ---- */

/** Lê um documento por _id */
export const getDoc = async (db, id, { rev } = {}) => {
  const { data } = await couch.get(`/${db}/${encodeURIComponent(id)}`, {
    params: rev ? { rev } : undefined
  });
  return data;
};

/** Lista documentos via _all_docs (GET) ou por chaves (POST) */
export const getDocAll = async (
  db,
  {
    include_docs = true,
    limit = 20,
    skip = 0,
    startkey,
    endkey,
    keys // se array, usa POST
  } = {}
) => {
  // por chaves específicas (POST)
  if (Array.isArray(keys)) {
    const { data } = await couch.post(
      `/${db}/_all_docs`,
      { keys },
      { params: { include_docs } }
    );
    return data;
  }

  // varrer intervalo (GET)
  const params = { include_docs, limit, skip };
  if (startkey !== undefined) params.startkey = JSON.stringify(startkey);
  if (endkey !== undefined) params.endkey = JSON.stringify(endkey);

  const { data } = await couch.get(`/${db}/_all_docs`, { params });
  return data;
};

/** Consulta uma view (map/reduce) */
export const getView = async (
  db,
  ddoc,   // nome do design doc (sem _design/)
  view,   // nome da view
  {
    key,
    startkey,
    endkey,
    limit,
    descending,
    include_docs,
    reduce
  } = {}
) => {
  const params = {};
  if (key !== undefined) params.key = JSON.stringify(key);
  if (startkey !== undefined) params.startkey = JSON.stringify(startkey);
  if (endkey !== undefined) params.endkey = JSON.stringify(endkey);
  if (limit !== undefined) params.limit = limit;
  if (descending !== undefined) params.descending = descending;
  if (include_docs !== undefined) params.include_docs = include_docs;
  if (reduce !== undefined) params.reduce = reduce;

  const { data } = await couch.get(
    `/${db}/_design/${encodeURIComponent(ddoc)}/_view/${encodeURIComponent(view)}`,
    { params }
  );
  return data;
};

/** Cria índice Mango (recomendado antes de _find com sort/selector) */
export const createIndex = async (db, { fields, name, type = "json" }) => {
  const payload = { index: { fields }, name, type };
  const { data } = await couch.post(`/${db}/_index`, payload);
  return data;
};

/** Consulta Mango (_find) */
export const find = async (
  db,
  {
    selector = {},
    fields,
    sort,
    limit = 25,
    bookmark,   // para paginação
    use_index   // ["ddocName","indexName"] ou "indexName"
  } = {}
) => {
  const body = { selector, limit };
  if (fields) body.fields = fields;
  if (sort) body.sort = sort;
  if (bookmark) body.bookmark = bookmark;
  if (use_index) body.use_index = use_index;

  const { data } = await couch.post(`/${db}/_find`, body);
  return data; // { docs, warning?, execution_stats?, bookmark }
};

/** Upsert (cria ou atualiza preservando _rev) */
export const upsertDoc = async (db, doc) => {
  if (!doc?._id) throw new Error("doc precisa ter _id");
  try {
    const current = await getDoc(db, doc._id);
    const { data } = await couch.put(
      `/${db}/${encodeURIComponent(doc._id)}`,
      { ...current, ...doc, _rev: current._rev }
    );
    return data;
  } catch (err) {
    if (err.response?.status === 404) {
      const { data } = await couch.put(
        `/${db}/${encodeURIComponent(doc._id)}`,
        doc
      );
      return data;
    }
    throw err;
  }
};

/** Baixa um anexo */
export const getAttachment = async (db, id, attachmentName) => {
  const res = await couch.get(
    `/${db}/${encodeURIComponent(id)}/${encodeURIComponent(attachmentName)}`,
    { responseType: "arraybuffer" }
  );
  return res.data;
};
