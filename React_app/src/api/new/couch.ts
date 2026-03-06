// couch.ts (ESM) — CouchDB client com tipagens TypeScript
import axios, { AxiosInstance, AxiosError } from "axios";

// ==================== Error Types ====================

export class CouchDBError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public reason?: string,
    public error?: string,
    public originalError?: any,
  ) {
    super(message);
    this.name = "CouchDBError";
  }
}

export class IndexError extends CouchDBError {
  constructor(
    message: string,
    statusCode?: number,
    reason?: string,
    error?: string,
    originalError?: any,
  ) {
    super(message, statusCode, reason, error, originalError);
    this.name = "IndexError";
  }
}

// ==================== Error Mapping ====================

interface CouchErrorResponse {
  error?: string;
  reason?: string;
}

/**
 * Mapeia erros HTTP do CouchDB para mensagens amigáveis
 */
function mapCouchError(status: number, errorData?: CouchErrorResponse): string {
  const errorMap: Record<number, Record<string, string>> = {
    400: {
      invalid_json: "JSON inválido enviado ao servidor",
      bad_request: "Requisição inválida",
      illegal_database_name: "Nome de banco de dados inválido",
      default: "Requisição malformada",
    },
    401: {
      unauthorized: "Credenciais inválidas ou ausentes",
      default: "Não autorizado",
    },
    403: {
      forbidden: "Acesso negado",
      default: "Permissão insuficiente",
    },
    404: {
      not_found: "Recurso não encontrado",
      no_db_file: "Banco de dados não existe",
      missing: "Documento não encontrado",
      default: "Não encontrado",
    },
    409: {
      conflict: "Conflito de documento (versão desatualizada)",
      file_exists: "Banco de dados já existe",
      default: "Conflito detectado",
    },
    412: {
      missing_rev: "Revisão (_rev) obrigatória não fornecida",
      default: "Pré-condição falhou",
    },
    500: {
      internal_server_error: "Erro interno do servidor CouchDB",
      default: "Erro interno do servidor",
    },
    503: {
      service_unavailable: "Serviço CouchDB temporariamente indisponível",
      default: "Serviço indisponível",
    },
  };

  const statusErrors = errorMap[status];
  if (!statusErrors) {
    return `Erro HTTP ${status}`;
  }

  const errorType = errorData?.error || "default";
  return statusErrors[errorType] || statusErrors["default"];
}

/**
 * Processa erro do Axios e lança CouchDBError apropriado
 */
function handleCouchError(err: any, context: string): never {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const errorData = err.response?.data as CouchErrorResponse | undefined;
    const reason = errorData?.reason;
    const error = errorData?.error;

    const message = `${context}: ${mapCouchError(status || 500, errorData)}${reason ? ` - ${reason}` : ""}`;

    throw new CouchDBError(message, status, reason, error, err);
  }

  // Erro não-Axios (rede, timeout, etc)
  throw new CouchDBError(
    `${context}: ${err.message || "Erro desconhecido"}`,
    undefined,
    undefined,
    undefined,
    err,
  );
}

// ==================== Types ====================

export interface CouchDoc {
  _id: string;
  _rev?: string;
  [key: string]: any;
}

export interface AllDocsRow<T = CouchDoc> {
  id: string;
  key: string;
  value: { rev: string };
  doc?: T;
}

export interface AllDocsResponse<T = CouchDoc> {
  total_rows: number;
  offset: number;
  rows: AllDocsRow<T>[];
}

export interface AllDocsOptions {
  include_docs?: boolean;
  limit?: number;
  skip?: number;
  startkey?: string;
  endkey?: string;
  keys?: string[];
}

export interface ViewOptions {
  key?: any;
  startkey?: any;
  endkey?: any;
  limit?: number;
  descending?: boolean;
  include_docs?: boolean;
  reduce?: boolean;
}

export interface ViewResponse<T = any> {
  total_rows?: number;
  offset?: number;
  rows: Array<{
    id?: string;
    key: any;
    value: any;
    doc?: T;
  }>;
}

export interface IndexOptions {
  fields: string[];
  name?: string;
  type?: "json" | "text";
}

export interface FindOptions {
  selector?: Record<string, any>;
  fields?: string[];
  sort?: Array<Record<string, "asc" | "desc">>;
  limit?: number;
  skip?: number;
  bookmark?: string;
  use_index?: string | string[];
}

export interface FindResponse<T = CouchDoc> {
  docs: T[];
  bookmark?: string;
  warning?: string;
}

export interface ChangesOptions {
  since?: string | number;
  limit?: number;
  feed?: "normal" | "longpoll" | "continuous";
  include_docs?: boolean;
  filter?: string;
  timeout?: number;
  heartbeat?: number;
  [key: string]: any;
}

export interface ChangesResponse<T = CouchDoc> {
  results: Array<{
    seq: string | number;
    id: string;
    changes: Array<{ rev: string }>;
    doc?: T;
    deleted?: boolean;
  }>;
  last_seq: string | number;
  pending?: number;
}

// ==================== Configuration ====================

export const COUCH_HOST = "https://admin:wyrd@db.vpn.ind.br/";
export const COUCH_DB = "lindsay-data"; // banco de dados padrão (pivôs, alertas, etc.)
export const COUCH_USERS_DB = "lindsay-users"; // banco de usuários (admin, revenda, cliente)
const USER = "admin";
const PASS = "wyrd";

// ==================== Axios Instance ====================

export const couch: AxiosInstance = axios.create({
  baseURL: COUCH_HOST,
  timeout: 65000,
  validateStatus: (s) => s >= 200 && s < 600,
});

// Basic Auth interceptor
couch.interceptors.request.use((cfg) => {
  cfg.headers.set("Content-Type", "application/json");
  // Usa btoa nativo do navegador (disponível em todos os navegadores modernos)
  const credentials = btoa(`${USER}:${PASS}`);
  cfg.headers.set("Authorization", `Basic ${credentials}`);
  return cfg;
});

// ==================== API Functions ====================

/**
 * Healthcheck do servidor CouchDB
 */
export async function pingCouch(): Promise<boolean> {
  try {
    const up = await couch.get("/_up");
    return up.status === 200;
  } catch {
    try {
      const dbs = await couch.get("/_all_dbs");
      return Array.isArray(dbs.data);
    } catch {
      return false;
    }
  }
}

/**
 * Monitora mudanças em um banco (_changes feed)
 * @param db Nome do banco
 * @param params Parâmetros da query
 * @param options Timeout do cliente
 */
export async function getChanges<T = CouchDoc>(
  db: string,
  params: ChangesOptions = {},
  { clientTimeout = 65000 }: { clientTimeout?: number } = {},
): Promise<ChangesResponse<T>> {
  const res = await couch.get(`/${db}/_changes`, {
    params,
    timeout: clientTimeout,
  });
  return res.data;
}

/**
 * Busca um documento por _id
 * @param db Nome do banco
 * @param id ID do documento
 * @param options Opções (ex: rev específica)
 */
export async function getDoc<T = CouchDoc>(
  db: string,
  id: string,
  { rev }: { rev?: string } = {},
): Promise<T> {
  const res = await couch.get(`/${db}/${encodeURIComponent(id)}`, {
    params: rev ? { rev } : undefined,
  });
  if (res.status >= 400) {
    const err = new Error(`Couch GET ${id} failed: ${res.status}`) as any;
    err.response = res;
    throw err;
  }
  return res.data as T;
}

/**
 * Lista documentos via _all_docs (GET por range ou POST por keys)
 * @param db Nome do banco
 * @param options Opções de busca
 */
export async function getDocAll<T = CouchDoc>(
  db: string,
  options: AllDocsOptions = {},
): Promise<AllDocsResponse<T>> {
  const {
    include_docs = true,
    limit = 20,
    skip = 0,
    startkey,
    endkey,
    keys,
  } = options;

  // Se tiver keys, usa POST
  if (Array.isArray(keys)) {
    const { data } = await couch.post(
      `/${db}/_all_docs`,
      { keys },
      { params: { include_docs } },
    );
    return data;
  }

  // Senão, usa GET com range
  const params: any = { include_docs, limit, skip };
  if (startkey !== undefined) params.startkey = JSON.stringify(startkey);
  if (endkey !== undefined) params.endkey = JSON.stringify(endkey);

  const { data } = await couch.get(`/${db}/_all_docs`, { params });
  return data;
}

/**
 * Consulta uma view (map/reduce)
 * @param db Nome do banco
 * @param ddoc Nome do design document (sem _design/)
 * @param view Nome da view
 * @param options Opções de query
 */
export async function getView<T = any>(
  db: string,
  ddoc: string,
  view: string,
  options: ViewOptions = {},
): Promise<ViewResponse<T>> {
  const { key, startkey, endkey, limit, descending, include_docs, reduce } =
    options;

  const params: any = {};
  if (key !== undefined) params.key = JSON.stringify(key);
  if (startkey !== undefined) params.startkey = JSON.stringify(startkey);
  if (endkey !== undefined) params.endkey = JSON.stringify(endkey);
  if (limit !== undefined) params.limit = limit;
  if (descending !== undefined) params.descending = descending;
  if (include_docs !== undefined) params.include_docs = include_docs;
  if (reduce !== undefined) params.reduce = reduce;

  const { data } = await couch.get(
    `/${db}/_design/${encodeURIComponent(ddoc)}/_view/${encodeURIComponent(view)}`,
    { params },
  );
  return data;
}

/**
 * Cria índice Mango com tratamento robusto de erros
 * @param db Nome do banco
 * @param options Definição do índice
 * @throws {IndexError} Quando há erro na criação do índice
 * @returns Informações sobre o índice criado ou existente
 *
 * @example
 * ```ts
 * try {
 *   const result = await createIndex('my-db', {
 *     fields: ['timestamp', 'status'],
 *     name: 'idx-timestamp-status'
 *   });
 *   //console.log('Índice:', result.result); // 'created' ou 'exists'
 * } catch (err) {
 *   if (err instanceof IndexError) {
 *     console.error('Erro ao criar índice:', err.message);
 *     console.error('Status:', err.statusCode);
 *     console.error('Razão:', err.reason);
 *   }
 * }
 * ```
 */
export async function createIndex(
  db: string,
  options: IndexOptions,
): Promise<{ result: string; id: string; name: string }> {
  // Validação de parâmetros
  if (!db || typeof db !== "string") {
    throw new IndexError(
      "Nome do banco inválido",
      400,
      "Database name is required",
    );
  }

  if (
    !options.fields ||
    !Array.isArray(options.fields) ||
    options.fields.length === 0
  ) {
    throw new IndexError(
      "Campos do índice inválidos",
      400,
      "Index fields must be a non-empty array",
    );
  }

  const { fields, name, type = "json" } = options;

  // Validação de tipo de índice
  if (type !== "json" && type !== "text") {
    throw new IndexError(
      `Tipo de índice inválido: "${type}"`,
      400,
      'Index type must be "json" or "text"',
    );
  }

  const payload = { index: { fields }, name, type };

  try {
    const response = await couch.post(`/${db}/_index`, payload);

    // Verifica status HTTP
    if (response.status >= 400) {
      const errorData = response.data as CouchErrorResponse;
      throw new IndexError(
        `Falha ao criar índice: ${mapCouchError(response.status, errorData)}`,
        response.status,
        errorData?.reason,
        errorData?.error,
        response,
      );
    }

    const data = response.data;

    // Log diferenciado baseado no resultado

    return data;
  } catch (err: any) {
    // Se já é IndexError, apenas repassa
    if (err instanceof IndexError) {
      throw err;
    }

    // Caso contrário, processa com handleCouchError
    handleCouchError(err, `Criar índice no banco "${db}"`);
  }
}

/**
 * Consulta Mango (_find)
 * @param db Nome do banco
 * @param options Opções da query Mango
 */
export async function find<T = CouchDoc>(
  db: string,
  options: FindOptions = {},
): Promise<FindResponse<T>> {
  const {
    selector = {},
    fields,
    sort,
    limit = 25,
    skip,
    bookmark,
    use_index,
  } = options;

  const body: any = { selector, limit };
  if (fields) body.fields = fields;
  if (sort) body.sort = sort;
  if (skip !== undefined) body.skip = skip;
  if (bookmark) body.bookmark = bookmark;
  if (use_index) body.use_index = use_index;

  const { data } = await couch.post(`/${db}/_find`, body);
  return data;
}

/**
 * Upsert de documento (GET + PUT com _rev; cria se não existir)
 * @param db Nome do banco
 * @param doc Documento a ser salvo (precisa ter _id)
 */
export async function upsertDoc<T extends CouchDoc = CouchDoc>(
  db: string,
  doc: T,
): Promise<{ ok: boolean; id: string; rev: string }> {
  if (!doc?._id) throw new Error("doc precisa ter _id");

  try {
    const current = await getDoc<T>(db, doc._id);
    const { data } = await couch.put(`/${db}/${encodeURIComponent(doc._id)}`, {
      ...current,
      ...doc,
      _rev: current._rev,
    });
    return data;
  } catch (err: any) {
    if (err.response?.status === 404) {
      const { data } = await couch.put(
        `/${db}/${encodeURIComponent(doc._id)}`,
        doc,
      );
      return data;
    }
    throw err;
  }
}

/**
 * Baixa um anexo
 * @param db Nome do banco
 * @param id ID do documento
 * @param attachmentName Nome do anexo
 */
export async function getAttachment(
  db: string,
  id: string,
  attachmentName: string,
): Promise<ArrayBuffer> {
  const res = await couch.get(
    `/${db}/${encodeURIComponent(id)}/${encodeURIComponent(attachmentName)}`,
    { responseType: "arraybuffer" },
  );
  return res.data;
}

// ==================== Design Documents & Views ====================

export interface DesignDoc {
  _id: string;
  _rev?: string;
  views: Record<
    string,
    {
      map: string;
      reduce?: string;
    }
  >;
  language?: string;
}

/**
 * Cria ou atualiza um design document com views
 * @param db Nome do banco
 * @param ddocName Nome do design doc (sem _design/)
 * @param views Objeto com as views
 */
export async function upsertDesignDoc(
  db: string,
  ddocName: string,
  views: DesignDoc["views"],
): Promise<{ ok: boolean; id: string; rev: string }> {
  const ddocId = `_design/${ddocName}`;

  const newDoc: DesignDoc = {
    _id: ddocId,
    views,
    language: "javascript",
  };

  try {
    // Tenta buscar o design doc existente
    const existing = await getDoc<DesignDoc>(db, ddocId);

    // Atualiza com a rev existente
    const { data } = await couch.put(`/${db}/${encodeURIComponent(ddocId)}`, {
      ...newDoc,
      _rev: existing._rev,
    });
    //console.log(`✅ Design document atualizado: ${ddocName}`);
    return data;
  } catch (err: any) {
    // Se não existe, cria novo
    if (err.response?.status === 404) {
      const { data } = await couch.put(
        `/${db}/${encodeURIComponent(ddocId)}`,
        newDoc,
      );
      //console.log(`✅ Design document criado: ${ddocName}`);
      return data;
    }
    throw err;
  }
}

/**
 * Consulta uma view com suporte a range de chaves compostas
 * Otimizado para grandes volumes de dados
 * @param db Nome do banco
 * @param ddoc Nome do design document (sem _design/)
 * @param view Nome da view
 * @param options Opções de query
 */
export async function queryView<T = any>(
  db: string,
  ddoc: string,
  view: string,
  options: ViewOptions & {
    inclusive_end?: boolean;
    skip?: number;
    stale?: "ok" | "update_after";
  } = {},
): Promise<ViewResponse<T>> {
  const {
    key,
    startkey,
    endkey,
    limit,
    descending,
    include_docs,
    reduce,
    inclusive_end = true,
    skip,
    stale,
  } = options;

  const params: any = {};
  if (key !== undefined) params.key = JSON.stringify(key);
  if (startkey !== undefined) params.startkey = JSON.stringify(startkey);
  if (endkey !== undefined) params.endkey = JSON.stringify(endkey);
  if (limit !== undefined) params.limit = limit;
  if (descending !== undefined) params.descending = descending;
  if (include_docs !== undefined) params.include_docs = include_docs;
  if (reduce !== undefined) params.reduce = reduce;
  if (inclusive_end !== undefined) params.inclusive_end = inclusive_end;
  if (skip !== undefined) params.skip = skip;
  if (stale !== undefined) params.stale = stale;

  try {
    const { data } = await couch.get(
      `/${db}/_design/${encodeURIComponent(ddoc)}/_view/${encodeURIComponent(view)}`,
      { params },
    );
    return data;
  } catch (err) {
    handleCouchError(err, `Query view ${ddoc}/${view}`);
  }
}

/**
 * Cria as views otimizadas para histórico de dados
 * Execute uma vez na inicialização da aplicação
 */
export async function ensureHistoryViews(db: string): Promise<void> {
  const views: DesignDoc["views"] = {
    // View para tensao_raw: chave = [irrigadorId, tipo, timestamp]
    tensao_by_irrigador: {
      map: "function(doc) { if (doc.table === 'tensao_raw' && doc.irrigadorId && doc.timestamp) { emit([doc.irrigadorId, doc.tipo || '', doc.timestamp], null); } }",
    },

    // View para sw_raw: chave = [irrigadorId, timestamp]
    sw_by_irrigador: {
      map: "function(doc) { if (doc.table === 'sw_raw' && doc.irrigadorId && doc.timestamp) { emit([doc.irrigadorId, doc.timestamp], null); } }",
    },

    // View para events: chave = [irrigadorId, eventType, timestamp]
    events_by_irrigador: {
      map: "function(doc) { if (doc.table === 'events' && doc.timestamp) { emit([doc.irrigadorId || '', doc.eventType || '', doc.timestamp], null); } }",
    },

    // View para events por timestamp (todos os irrigadores)
    events_by_timestamp: {
      map: "function(doc) { if (doc.table === 'events' && doc.timestamp) { emit(doc.timestamp, null); } }",
    },

    alert_history: {
      map: "function (doc) { if (doc.table === 'events' && doc.timestamp !== undefined && doc.irrigadorId !== undefined) { emit([doc.irrigadorId, doc.timestamp], null); } }",
    },
  };

  await upsertDesignDoc(db, "history", views);
  //console.log("✅ Views de histórico criadas/atualizadas com sucesso");
}
