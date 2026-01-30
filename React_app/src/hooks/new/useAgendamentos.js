// useAgendamentos.js - Hook para gerenciar agendamentos (timers)
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getDoc, upsertDoc, find } from "../../api/new/couch";

// ==================== Utility Functions ====================

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
    // 404 significa que o documento não existe ainda - retorna null silenciosamente
    if (err?.response?.status === 404) {
      return null;
    }
    // Outros erros devem ser propagados
    console.error(`[getById] Error fetching ${id}:`, err);
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
    note: ev?.note,
  });
}

// upsert com retry em conflito + backoff progressivo
export async function upsertWithRetry(db, buildDoc, { maxRetries = 4 } = {}) {
  let tries = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    tries++;
    const candidate = await buildDoc();
    try {
      const res = await upsertDoc(db, candidate);
      return { ...candidate, _rev: res?.rev ?? candidate?._rev };
    } catch (err) {
      const isConflict =
        err?.response?.status === 409 || /conflict/i.test(err?.message || "");
      if (!isConflict || tries >= maxRetries) throw err;
      const backoffMs = 50 * Math.pow(2, tries - 1);
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

// ==================== Hook ====================

// Cache simples para evitar múltiplas requisições
const fetchCache = new Map();
const CACHE_TTL = 5000; // 5 segundos

/**
 * Hook para gerenciar agendamentos (timers)
 * @param {string} db - Nome do banco de dados
 * @param {string} irrigadorId - ID do irrigador (opcional, para filtrar)
 */
export function useAgendamentos(db = 'lindsay-data', irrigadorId = null) {
  const [agendamentos, setAgendamentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Buscar todos os agendamentos
  const fetchAgendamentos = useCallback(async () => {
    const cacheKey = `${db}:${irrigadorId || 'all'}`;
    const cached = fetchCache.get(cacheKey);

    // Se tem cache válido, usar
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setAgendamentos(cached.data);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const selector = {
        _id: { $regex: '^timer:.*:current$' }
      };

      if (irrigadorId) {
        selector.id_origem = irrigadorId;
      }

      const result = await find(db, {
        selector,
        limit: 10000
      });

      const docs = result.docs || [];
      setAgendamentos(docs);

      // Atualizar cache
      fetchCache.set(cacheKey, {
        data: docs,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('[useAgendamentos] Error fetching:', err);
      setError(err?.message || 'Erro ao buscar agendamentos');
    } finally {
      setLoading(false);
    }
  }, [db, irrigadorId]);

  // Buscar agendamento por id_origem
  const findAgendamentoByIdOrigem = useCallback((id_origem) => {
    return agendamentos.find(agendamento => agendamento.id_origem === id_origem);
  }, [agendamentos]);

  // Adicionar/atualizar agendamento
  const saveAgendamento = useCallback(async (idOrigem, data) => {
    try {
      const result = await setCurrent(db, idOrigem, data);

      // Limpar cache para forçar atualização
      const cacheKey = `${db}:${irrigadorId || 'all'}`;
      fetchCache.delete(cacheKey);

      await fetchAgendamentos(); // Atualizar lista
      return result;
    } catch (err) {
      console.error('[useAgendamentos] Error saving:', err);
      throw err;
    }
  }, [db, irrigadorId, fetchAgendamentos]);

  // Adicionar evento ao histórico
  const addHistoryEvent = useCallback(async (idOrigem, event) => {
    try {
      const result = await appendHistoryEvent(db, idOrigem, event);
      return result;
    } catch (err) {
      console.error('[useAgendamentos] Error adding history event:', err);
      throw err;
    }
  }, [db]);

  // Buscar agendamento específico por id_origem
  const getAgendamento = useCallback(async (idOrigem) => {
    try {
      const id = currentId(idOrigem);
      return await getById(db, id);
    } catch (err) {
      console.error('[useAgendamentos] Error getting:', err);
      throw err;
    }
  }, [db]);

  // Forçar atualização (ignorar cache)
  const refresh = useCallback(async () => {
    const cacheKey = `${db}:${irrigadorId || 'all'}`;
    fetchCache.delete(cacheKey);
    await fetchAgendamentos();
  }, [db, irrigadorId, fetchAgendamentos]);

  // Carregar ao montar
  useEffect(() => {
    fetchAgendamentos();
  }, [fetchAgendamentos]);

  return useMemo(() => ({
    agendamentos,
    loading,
    error,
    fetchAgendamentos,
    findAgendamentoByIdOrigem,
    saveAgendamento,
    addHistoryEvent,
    getAgendamento,
    refresh
  }), [
    agendamentos,
    loading,
    error,
    fetchAgendamentos,
    findAgendamentoByIdOrigem,
    saveAgendamento,
    addHistoryEvent,
    getAgendamento,
    refresh
  ]);
}

// ==================== Exemplo de Uso ====================
/*
// Em um componente React:
import { useAgendamentos } from './hooks/new/useAgendamentos';

function MeuComponente() {
  // Buscar todos os agendamentos
  const {
    agendamentos,
    loading,
    error,
    findAgendamentoByIdOrigem,
    saveAgendamento,
    addHistoryEvent,
    refresh
  } = useAgendamentos('lindsay-data');

  // Ou buscar apenas de um irrigador específico
  const { agendamentos: agendamentosIrrigador } = useAgendamentos('lindsay-data', 'IRRIG123');

  // Salvar um agendamento
  const handleSave = async () => {
    await saveAgendamento('IRRIG123', {
      timer_value: 120,
      scheduled_for: '2025-01-20T10:00:00Z',
      note: 'Agendamento de teste'
    });
  };

  // Adicionar evento ao histórico
  const handleAddEvent = async () => {
    await addHistoryEvent('IRRIG123', {
      type: 'start',
      timer_value: 120,
      by: 'João Silva',
      note: 'Iniciado manualmente'
    });
  };

  // Buscar agendamento específico
  const agendamento = findAgendamentoByIdOrigem('IRRIG123');

  // Forçar atualização (ignorar cache)
  const handleRefresh = () => {
    refresh();
  };

  return (
    <div>
      {loading && <p>Carregando...</p>}
      {error && <p>Erro: {error}</p>}
      <button onClick={handleRefresh}>Atualizar</button>
      {agendamentos.map(ag => (
        <div key={ag._id}>{ag.id_origem}</div>
      ))}
    </div>
  );
}
*/
