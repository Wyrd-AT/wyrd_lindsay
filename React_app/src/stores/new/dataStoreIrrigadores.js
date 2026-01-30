import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { couch, find as couchFind, createIndex, getDoc, upsertDoc } from '../../api/new/couch.ts';

// === Config do banco ===
const DB = 'lindsay-data';

// garante o índice Mango apenas 1x
let ensuredIndex = false;
async function ensureIndex() {
  if (ensuredIndex) return;
  try {
    // Cria índice para a query que será feita
    await createIndex(DB, {
      fields: ['table', 'companyId'],
      name: 'idx_table_company',
      type: 'json'
    });
  } catch (e) {
    // 409 = índice já existe, pode ignorar
    if (e?.response?.status !== 409) {
      console.warn('[DataStore] Erro ao criar índice:', e?.message || e);
    } else {
      console.log('[DataStore] Índice já existe, ignorando erro 409.');
    }
  }
  ensuredIndex = true;
}

// gerador simples de _id quando necessário
const genId = (companyId) =>
  `irrigador:${companyId || 'na'}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

export const useDataStoreIrrigadores = create((set, get) => ({
  irrigadores: [],
  syncTimestamp: Date.now(),
  isLoading: false,
  error: null,

  fetchIrrigadores: async (companyId) => {
    set({ isLoading: true, error: null });
    try {
      await ensureIndex();
      
      const data = await couchFind(DB, {
        selector: { 
          table: 'irrigadores', 
          companyId: companyId 
        },
        limit: 100,
        // Remove o use_index que está causando problema
        // O CouchDB vai escolher automaticamente o índice correto
      });
      set({ 
        irrigadores: data.docs || [], 
        syncTimestamp: Date.now(),
        isLoading: false 
      });
    } catch (err) {
      console.error('[DataStore] fetchIrrigadores error:', err);
      set({ 
        error: err?.message || 'Erro ao buscar irrigadores',
        isLoading: false 
      });
    }
  },

  // recebe (payload, companyId)
  addIrrigador: async (payload, companyId) => {
    try {
      const doc = {
        ...payload,
        table: 'irrigadores',
        companyId,
      };

      // upsertDoc exige _id – se não vier, geramos um
      const _id = doc._id || genId(companyId);
      const res = await upsertDoc(DB, { ...doc, _id });

      set((state) => ({
        irrigadores: [
          ...state.irrigadores,
          { ...doc, _id: res.id, _rev: res.rev },
        ],
        syncTimestamp: Date.now(),
      }));

      return { id: res.id, rev: res.rev };
    } catch (err) {
      console.error('[DataStore] addIrrigador error:', err);
      throw err;
    }
  },

  updateIrrigador: async (_id, updates) => {
    try {
      // pega a versão atual no Couch para obter _rev
      const current = await getDoc(DB, _id);
      const merged = { ...current, ...updates, _rev: current._rev };

      // salva com PUT direto
      const { data } = await couch.put(
        `/${DB}/${encodeURIComponent(_id)}`,
        merged
      );
      const rev = data.rev || data._rev;

      set((state) => ({
        irrigadores: state.irrigadores.map((doc) =>
          doc._id === _id ? { ...doc, ...updates, _rev: rev } : doc
        ),
        syncTimestamp: Date.now(),
      }));

      return { id: _id, rev };
    } catch (err) {
      // conflito -> refaz com _rev mais recente
      if (err?.response?.status === 409) {
        console.warn('[DataStore] updateIrrigador 409 — tentando novamente com _rev novo.');
        const latest = await getDoc(DB, _id);
        const merged = { ...latest, ...updates, _rev: latest._rev };
        const { data } = await couch.put(
          `/${DB}/${encodeURIComponent(_id)}`,
          merged
        );
        const rev = data.rev || data._rev;

        set((state) => ({
          irrigadores: state.irrigadores.map((doc) =>
            doc._id === _id ? { ...doc, ...updates, _rev: rev } : doc
          ),
          syncTimestamp: Date.now(),
        }));
        return { id: _id, rev };
      }
      console.error('[DataStore] updateIrrigador error:', err);
      throw err;
    }
  },

  removeIrrigador: async (_id) => {
    try {
      // precisa do _rev pra deletar
      const cur = await getDoc(DB, _id);
      const res = await couch.delete(
        `/${DB}/${encodeURIComponent(_id)}`,
        { params: { rev: cur._rev } }
      );
      if (res.status >= 400) {
        throw new Error(`Couch DELETE failed: ${res.status}`);
      }

      set((state) => ({
        irrigadores: state.irrigadores.filter((d) => d._id !== _id),
        syncTimestamp: Date.now(),
      }));
    } catch (err) {
      console.error('[DataStore] removeIrrigador error:', err);
      throw err;
    }
  },
}));

export function useIrrigadores(companyId) {
  const irrigadores = useDataStoreIrrigadores((s) => s.irrigadores);
  const fetchIrrigadores = useDataStoreIrrigadores((s) => s.fetchIrrigadores);
  const isLoading = useDataStoreIrrigadores((s) => s.isLoading);
  const error = useDataStoreIrrigadores((s) => s.error);

  useEffect(() => {
    if (companyId) fetchIrrigadores(companyId);
  }, [fetchIrrigadores, companyId]);

  return useMemo(() => irrigadores, [irrigadores]);
}