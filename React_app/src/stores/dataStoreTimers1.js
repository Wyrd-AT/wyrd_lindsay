import { create } from 'zustand';
import { useEffect, useMemo } from 'react';
import { saveData } from '../api/database_app';
import { localDB, remoteDB } from '../api/database';

export const useDataStoreTimers = create((set, get) => ({
  timers: [],
  syncTimestamp: Date.now(),

  // Função para buscar timers do banco remoto (CouchDB)
  fetchTimers: async () => {
    try {
      const result = await remoteDB.find({ selector: { status: 'agendado' } });
      if (result.docs?.length) {
        set({ timers: result.docs, syncTimestamp: Date.now() });
      } else {
        console.log('Nenhum timer remoto. Tentando local...');
        const local = await localDB.find({ selector: { status: 'agendado' } }).catch(() => ({ docs: [] }));
        set({ timers: local.docs || [], syncTimestamp: Date.now() });
      }
    } catch (err) {
      console.error('[DataStore] fetchTimers error:', err);
    }
  },


  // Função para adicionar um novo timer
  // Substitua seu addTimer por este:
  addTimer: async (payload) => {
    try {
      const _id = payload._id || `timer:${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const doc = {
        ...payload,
        _id,
        status: 'agendado',
      };

      // ⬇️ GARANTA que esta linha escreve no CouchDB remoto:
      // Opção A: direto no Pouch/Couch REMOTO
      const res = await remoteDB.put(doc); // { ok, id, rev }

      // Opção B (se quiser manter saveData):
      // const { id, rev } = await saveData(doc, { db: 'remote' }); // ajuste a assinatura

      const saved = { ...doc, _id: res.id, _rev: res.rev };

      set(state => ({
        timers: [...state.timers.filter(t => t._id !== res.id), saved],
        syncTimestamp: Date.now(),
      }));

      // ⬅️ IMPORTANTE: retorne o doc salvo para o AlertEdit
      return saved;
    } catch (err) {
      console.error('[DataStore] addTimer error:', err);
      throw err; // deixa o AlertEdit exibir/logar o erro
    }
  },


  // Função para atualizar um timer existente
  updateTimer: async (_id, updates) => {
    try {
      const existing = await remoteDB.get(_id);
      const toSave = { ...existing, ...updates, _id };
      const res = await remoteDB.put(toSave); // ou saveData(toSave, { db: 'remote' })

      set(state => ({
        timers: state.timers.map(doc =>
          doc._id === res.id ? { ...existing, ...updates, _id: res.id, _rev: res.rev } : doc
        ),
        syncTimestamp: Date.now(),
      }));

      return { ...existing, ...updates, _id: res.id, _rev: res.rev };
    } catch (err) {
      console.error('[DataStore] updateTimer error:', err);
      throw err;
    }
  },


  removeTimer: async (_id) => {
    try {
      const doc = await remoteDB.get(_id);

      // remove no REMOTO (fonte de verdade)
      await remoteDB.remove(doc);

      // tenta remover no LOCAL, mas sem travar se não existir
      try {
        const localDoc = await localDB.get(_id);
        await localDB.remove(localDoc);
      } catch (e) {
        console.warn('[DataStore] removeTimer local skip:', e?.status || e?.message);
      }

      set(state => ({
        timers: state.timers.filter(d => d._id !== _id),
        syncTimestamp: Date.now(),
      }));
    } catch (err) {
      console.error('[DataStore] removeTimer error:', err);
      throw err;
    }
  },

}));

// Hook para buscar todos os timers
export function useTimer() {
  const timers = useDataStoreTimers(state => state.timers);
  const fetchTimers = useDataStoreTimers(state => state.fetchTimers);

  useEffect(() => {
    fetchTimers(); // Chama a função para buscar os timers
  }, [fetchTimers]);

  return useMemo(() => timers, [timers]);
}

// Hook para buscar um timer específico baseado em 'id_origem'
export function useSpecificTimer(id_origem) {
  const timers = useDataStoreTimers(state => state.timers);
  const fetchTimers = useDataStoreTimers(state => state.fetchTimers);

  useEffect(() => {
    fetchTimers(); // Chama a função para buscar os timers
  }, [fetchTimers]);


  //console.log('useSpecificTimer chamado com id_origem:', id_origem);
  //console.log('Timers atuais:', timers);

  // Busca o timer específico com base no 'id_origem'
  const timer = useMemo(() => {
    return timers.find(timer => timer.id_origem == id_origem);  // Filtra pelo id_origem
  }, [timers, id_origem]);
  //console.log('Timer encontrado:', timer);
  return timer;
}
