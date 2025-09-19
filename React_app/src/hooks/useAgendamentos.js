// timerData.js (ou o nome que preferir)
import { getDoc, upsertDoc } from "../api/couch";

// ids canônicos
export const currentId = (idOrigem) => `timer:${idOrigem}:current`;
export const historyIdMonthly = (idOrigem, date = new Date()) => {
  const ym = date.toISOString().slice(0, 7); // "YYYY-MM"
  return `timer:${idOrigem}:history:${ym}`;
};

// leitura direta por id
export async function getById(db, id) {
  try {
    return await getDoc(db, id);
  } catch (err) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

// util: remove campos undefined (evita ruído no histórico)
const stripUndefined = (obj) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

// util: normaliza o evento antes de gravar
function normalizeEvent(ev) {
  const nowIso = new Date().toISOString();
  const atIso = ev?.at ? new Date(ev.at).toISOString() : nowIso;
  return stripUndefined({
    type: ev?.type,
    at: atIso,
    by: ev?.by ?? "Desconhecido",
    timer_value: ev?.timer_value,
    scheduled_for: ev?.scheduled_for,
    related: ev?.related,
    note: ev?.note, // se quiser permitir observações
  });
}

// upsert com retry em conflito + backoff progressivo
export async function upsertWithRetry(db, buildDoc, { maxRetries = 4 } = {}) {
  let tries = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    tries++;
    const candidate = await buildDoc(); // inclua _rev se existir
    try {
      const res = await upsertDoc(db, candidate); // Couch: { ok, id, rev }
      // devolve o doc já sincronizado com o novo _rev
      return { ...candidate, _rev: res?.rev ?? candidate?._rev };
    } catch (err) {
      const isConflict =
        err?.response?.status === 409 || /conflict/i.test(err?.message || "");
      if (!isConflict || tries >= maxRetries) throw err;
      const backoffMs = 50 * Math.pow(2, tries - 1); // 50,100,200,400...
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
}

// atualiza o doc "current"
export async function setCurrent(db, idOrigem, patch) {
  const id = currentId(idOrigem);
  return upsertWithRetry(db, async () => {
    const existing = await getById(db, id);
    const nowIso = new Date().toISOString();
    const base = existing || {
      _id: id,
      id_origem: idOrigem,
      created_at: nowIso,
      updated_at: nowIso,
    };
    return {
      ...base,
      ...stripUndefined(patch),
      updated_at: nowIso,
      ...(existing?._rev ? { _rev: existing._rev } : {}),
    };
  });
}

// adiciona um evento no histórico (particionado por mês)
export async function appendHistoryEvent(db, idOrigem, event) {
  const now = new Date();
  const id = historyIdMonthly(idOrigem, now);
  const ev = normalizeEvent(event);

  return upsertWithRetry(db, async () => {
    const existing = await getById(db, id);
    const nowIso = now.toISOString();
    const base = existing || {
      _id: id,
      id_origem: idOrigem,
      events: [],
      event_count: 0,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const events = Array.isArray(base.events) ? base.events.slice() : [];
    events.push(ev);

    const MAX_EVENTS = 5000;
    let trimmed = events;
    if (events.length > MAX_EVENTS) {
      trimmed = events.slice(-MAX_EVENTS);
      // opcional: console.warn(`[history] trimming events for ${id}`);
    }

    return {
      ...base,
      events: trimmed,
      event_count: (base.event_count || 0) + 1,
      updated_at: nowIso,
      ...(existing?._rev ? { _rev: existing._rev } : {}),
    };
  });
}
