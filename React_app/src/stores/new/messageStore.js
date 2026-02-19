// src/stores/messageStore.couch.js
import { create } from 'zustand';
import {
    couch,
    find as couchFind,
    getDocAll,
    upsertDoc
} from '../../api/new/couch.ts';

const DB = 'lindsay-data'; // banco de dados principal

const TIME_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
const MAX_PARSED = Infinity;                     // limite máximo em memória
const CHANGES_TIMEOUT = 30000;                   // long-poll timeout
const DEBOUNCE_MS = 100;

// ====== formatação/parse de timestamp em America/Sao_Paulo ======
const TZ = 'America/Sao_Paulo';
const BR_LEGACY_RE = /^(\d{2}):(\d{2}):(\d{2}) (\d{2})\/(\d{2})\/(\d{4})$/;
const TZ_OFFSET = '-03:00'; // São Paulo

function formatTimestampSP(date = new Date()) {
  // "sv-SE" => "YYYY-MM-DD HH:mm:ss" no fuso informado
  const s = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(date);
  return `${s.replace(' ', 'T')}${TZ_OFFSET}`; // "YYYY-MM-DDTHH:mm:ss-03:00"
}

function parseBrLegacyTimestamp(ts) {
  // "12:28:05 18/09/2025" -> ms
  const m = BR_LEGACY_RE.exec(ts);
  if (!m) return NaN;
  const [, hh, mm, ss, dd, MM, yyyy] = m;
  const iso = `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}${TZ_OFFSET}`;
  return Date.parse(iso);
}

function parseTimestampAny(tsLike) {
  if (!tsLike) return NaN;
  const s = String(tsLike);
  // formato BR legado (mqtt_messages)
  if (BR_LEGACY_RE.test(s)) return parseBrLegacyTimestamp(s);
  // ISO/“YYYY-MM-DD HH:mm:ss” etc. (normaliza espaço para 'T')
  return Date.parse(s.includes('T') ? s : s.replace(' ', 'T'));
}

/* ---------- Healthcheck simples ---------- */
async function pingCouch() {
  try {
    const up = await couch.get('/_up');
    return up.status === 200;
  } catch {
    try {
      const dbs = await couch.get('/_all_dbs');
      return Array.isArray(dbs.data);
    } catch {
      return false;
    }
  }
}

/* ---------- Helpers ---------- */
export const parseMessage = (doc) => {
  if (!doc || doc._id?.startsWith?.('_design/') || !doc.table) return null;

  // inclua aqui os tipos que você precisa acompanhar ao vivo
  const tipos = ['mqtt_messages', 'command', 'sw_recente'];
  if (!tipos.includes(doc.table)) return null;

  const base = {
    _id: doc._id,
    _rev: doc._rev,
    topic: doc.topic,
    type: doc.type,
    origin: doc.origin,
    table: doc.table,
    data: doc.data,
    timestamp: doc.timestamp, // mantém como veio; parser trata os dois formatos
  };
  return { ...base };
};

function trimToMax(arr, max) {
  if (arr.length <= max) return arr;
  return arr.slice(arr.length - max);
}

function isRecent(tsLike) {
  const t = parseTimestampAny(tsLike);
  return Number.isFinite(t) && t >= (Date.now() - TIME_WINDOW_MS);
}

const loadInitialMessages = async () => {
  // Filtramos a janela localmente por causa do legado BR
  try {
    const selector = { table: { $in: ['mqtt_messages', 'command', 'sw_recente'] } };
    const limit = 10000;
    let bookmark = null;
    const list = [];

    // paginação Mango
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const body = {
        selector,
        limit,
        sort: [{ table: 'asc' }], // usa índice composto (table, timestamp)
        use_index: ['idx_table_timestamp', 'by_table_timestamp'],
      };
      if (bookmark) body.bookmark = bookmark;

      const res = await couchFind(DB, body);
      const docs = res?.docs || [];
      if (!docs.length) break;

      for (const d of docs) {
        const msg = parseMessage(d);
        if (msg && isRecent(msg.timestamp)) list.push(msg);
      }

      if (!res?.bookmark || docs.length < limit) break;
      bookmark = res.bookmark;
    }

    // ordena corretamente pelos dois formatos
    list.sort((a, b) => parseTimestampAny(a.timestamp) - parseTimestampAny(b.timestamp));

    const messagesMap = new Map();
    for (const m of list) messagesMap.set(m._id, m);

    return {
      messagesMap,
      parsedMessages: list,
      lastSeq: 'now',
    };
  } catch (e) {
    console.warn('[messageStore] Mango _find indisponível, usando _all_docs fallback:', e?.message || e);
  }

  // Fallback (/_all_docs)
  const data = await getDocAll(DB, { include_docs: true, limit: 500_000 });
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const list = [];
  const map = new Map();

  for (const r of rows) {
    const msg = parseMessage(r.doc);
    if (msg && isRecent(msg.timestamp)) {
      list.push(msg);
      map.set(msg._id, msg);
    }
  }

  list.sort((a, b) => parseTimestampAny(a.timestamp) - parseTimestampAny(b.timestamp));

  let lastSeq = 'now';
  try {
    const ch = await couch.get(`/${DB}/_changes`, { params: { since: 'now', limit: 1 } });
    lastSeq = ch?.data?.last_seq ?? 'now';
  } catch { /* noop */ }

  return {
    messagesMap: map,
    parsedMessages: list,
    lastSeq,
  };
};

// loop de long-poll no _changes
async function startChangesLongPoll(get, set) {
  if (get()._changesActive) return; // evita múltiplos loops
  set({ _changesActive: true });

  let since = get()._lastSeq || 'now';

  // buffers para reduzir sets
  let pendingAdds = [];
  let pendingDeletes = new Set();
  let debounceTimer = null;

  const flush = () => {
    if (!pendingAdds.length && pendingDeletes.size === 0) return;

    set((state) => {
      // atualiza messagesMap incrementalmente
      const messagesMap = new Map(state.messagesMap);

      // deletions
      if (pendingDeletes.size) {
        for (const id of pendingDeletes) messagesMap.delete(id);
      }

      // adds/updates
      for (const msg of pendingAdds) {
        if (isRecent(msg.timestamp)) {
          messagesMap.set(msg._id, msg);
        }
      }

      // gera parsedMessages incrementalmente
      const parsed = state.parsedMessages.slice();
      const index = new Map(parsed.map((m, i) => [m._id, i]));

      // aplica deletes no array
      if (pendingDeletes.size) {
        for (let i = parsed.length - 1; i >= 0; i--) {
          if (pendingDeletes.has(parsed[i]._id)) parsed.splice(i, 1);
        }
      }

      // aplica adds/updates
      if (pendingAdds.length) {
        for (const msg of pendingAdds) {
          const pos = index.get(msg._id);
          if (pos != null) {
            parsed[pos] = msg;
          } else if (isRecent(msg.timestamp)) {
            parsed.push(msg);
          }
        }
      }

      // ordena pelos dois formatos
      parsed.sort((a, b) => parseTimestampAny(a.timestamp) - parseTimestampAny(b.timestamp));

      // aplica janela e limite
      const filtered = parsed.filter((m) => isRecent(m.timestamp));
      const trimmed = trimToMax(filtered, MAX_PARSED);

      // limpa buffers
      pendingAdds = [];
      pendingDeletes.clear();

      return { messagesMap, parsedMessages: trimmed };
    });
  };

  const scheduleFlush = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flush, DEBOUNCE_MS);
  };

  while (get()._changesActive) {
    try {
      const res = await couch.get(`/${DB}/_changes`, {
        params: {
          feed: 'longpoll',
          include_docs: true,
          timeout: CHANGES_TIMEOUT,
          since,
          heartbeat: 10000, // <<< mantém a conexão viva (envia \n a cada 10s)
          // Se seu Couch suportar, dá pra filtrar no servidor:
          // filter: '_selector',
          // selector: JSON.stringify({ table: { $in: ['mqtt_messages','command','sw_recente'] } }),
        },
      });

      const results = res?.data?.results || [];
      const last_seq = res?.data?.last_seq || since;

      if (results.length) {
        for (const chg of results) {
          const doc = chg.doc;
          if (!doc) continue;

          if (doc._deleted) {
            if (doc._id) pendingDeletes.add(doc._id);
            continue;
          }

          const msg = parseMessage(doc);
          if (msg) pendingAdds.push(msg);
        }
        scheduleFlush();
      }

      since = last_seq;
      set({ _lastSeq: last_seq });
    } catch (err) {
      console.error('[messageStore] _changes longpoll error:', err?.message || err);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  flush(); // flush final ao parar
}

export const useMessageStore = create((set, get) => ({
  messagesMap: new Map(),
  parsedMessages: [],
  isLoading: true,
  error: null,

  // controle interno do changes
  _changesActive: false,
  _lastSeq: 'now',

  // inicializa estado + changes feed
  initialize: async () => {
    // evita reentradas
    if (get()._changesActive || (!get().isLoading && get().parsedMessages.length)) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const ok = await pingCouch();
      if (!ok) throw new Error('CouchDB inacessível do dispositivo.');

      const { messagesMap, parsedMessages, lastSeq } = await loadInitialMessages();

      // aplica limite e janela
      const trimmed = trimToMax(parsedMessages.filter((m) => isRecent(m.timestamp)), MAX_PARSED);

      set({
        messagesMap,
        parsedMessages: trimmed,
        isLoading: false,
        _lastSeq: lastSeq || 'now',
      });

      startChangesLongPoll(get, set);
    } catch (err) {
      const msg =
        err?.message?.includes?.('Network Error')
          ? 'Falha de rede: verifique VPN/Internet, certificado TLS e porta do Couch.'
          : err?.message || String(err);

      console.error('[messageStore] initialize error', err);
      set({ error: msg, isLoading: false });
    }
  },

  // para o loop do changes
  stopChanges: () => {
    set({ _changesActive: false });
  },

  // atualiza o cache local apenas
  upsertMessage: (id, msgObj) => {
    // garante timestamp SP ao inserir localmente quando ausente
    const parsed = parseMessage({ ...msgObj, _id: id, timestamp: msgObj.timestamp || formatTimestampSP() });
    if (!parsed) return;

    set((state) => {
      const messagesMap = new Map(state.messagesMap);
      messagesMap.set(id, parsed);

      // merge incremental no array
      const parsedMessages = state.parsedMessages.slice();
      const idx = parsedMessages.findIndex((m) => m._id === id);
      if (idx >= 0) parsedMessages[idx] = parsed;
      else if (isRecent(parsed.timestamp)) parsedMessages.push(parsed);

      parsedMessages.sort((a, b) => parseTimestampAny(a.timestamp) - parseTimestampAny(b.timestamp));

      const filtered = parsedMessages.filter((m) => isRecent(m.timestamp));
      return {
        messagesMap,
        parsedMessages: trimToMax(filtered, MAX_PARSED),
      };
    });
  },

  // cria doc novo no Couch — usa POST /db (Couch gera _id)
  postMessage: async (doc) => {
    try {
      const body = doc.timestamp ? doc : { ...doc, timestamp: formatTimestampSP() };
      const res = await couch.post(`/${DB}`, body);
      if (res.status >= 400) throw new Error(`Couch POST failed: ${res.status}`);
      console.log('[messageStore] Couch POST success:', res.data);
      const id = res.data?.id;
      const rev = res.data?.rev;

      const msgObj = parseMessage({ ...body, _id: id, _rev: rev });
      if (msgObj) get().upsertMessage(id, msgObj);

      return res.data; // { ok, id, rev }
    } catch (err) {
      console.error('[messageStore] ERRO Couch POST:', err);
      throw err;
    }
  },

  // salva/atualiza (upsert) no Couch
  saveMessage: async (doc) => {
    try {
      if (!doc?._id) {
        return await get().postMessage(doc);
      }
      const toSave = doc.timestamp ? doc : { ...doc, timestamp: formatTimestampSP() };

      const res = await upsertDoc(DB, toSave); // GET+PUT ou cria se 404
      const id = res?.id || toSave._id;
      const rev = res?.rev;

      const finalDoc = { ...toSave, _id: id, _rev: rev };
      const msgObj = parseMessage(finalDoc);
      if (msgObj) get().upsertMessage(id, msgObj);

      return { id, rev };
    } catch (err) {
      console.error('[messageStore] Erro no saveMessage (Couch):', err);
      throw err;
    }
  },

  // lista tudo (/_all_docs)
  fetchMessages: async () => {
    try {
      const data = await getDocAll(DB, { include_docs: true, limit: 100_000 });
      const rows = Array.isArray(data?.rows) ? data.rows : [];
      return rows.map((r) => r.doc);
    } catch (err) {
      console.error('[messageStore] Erro no fetchMessages (Couch):', err);
      throw err;
    }
  },

  // Mango _find (passa seu query direto)
  readMessages: async (query) => {
    try {
      const data = await couchFind(DB, query);
      return data?.docs || [];
    } catch (err) {
      console.error('[messageStore] Erro no readMessages (Couch):', err);
      throw err;
    }
  },

  clearMessages: () => {
    set({ messagesMap: new Map(), parsedMessages: [] });
  },
}));

export default useMessageStore;
