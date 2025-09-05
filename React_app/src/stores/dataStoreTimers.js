import { create } from 'zustand'
import { useEffect, useMemo, useCallback} from 'react'
import { saveData } from '../api/database_app'
import { localDB, remoteDB } from '../api/database'

export const useDataStoreAgendamentos = create((set, get) => ({
  agendamentos: [],
  syncTimestamp: Date.now(),

  fetchAgendamentos: async () => {
    try {
      const result = await localDB.find({
        selector: { table: 'agendamento' }
      })
      set({ agendamentos: result.docs, syncTimestamp: Date.now() })
    } catch (err) {
      console.error('[DataStore] fetchAgendamentos error:', err)
    }
  },

  addAgendamento: async (payload) => {
    try {
      const doc = {
        ...payload,
        table: 'agendamento',
      }
      console.log("salvando")
      const { id, rev } = await saveData(doc)
      set(state => ({
        agendamentos: [
          ...state.agendamentos,
          { ...doc, _id: id, _rev: rev }
        ],
        syncTimestamp: Date.now()
      }))
    } catch (err) {
      console.error('[DataStore] addAgendamento error:', err)
    }
  },

  updateAgendamento: async (_id, updates) => {
    try {
      const existing = await localDB.get(_id)
      const toSave = { ...existing, ...updates, _id }
      const { id, rev } = await saveData(toSave)
      set(state => ({
        agendamentos: state.agendamentos.map(doc =>
          doc._id === id ? { ...doc, ...updates, _rev: rev } : doc
        ),
        syncTimestamp: Date.now()
      }))
    } catch (err) {
      console.error('[DataStore] updateAgendamento error:', err)
    }
  },

  removeAgendamento: async (_id) => {
    try {
      const doc = await localDB.get(_id)
      await localDB.remove(doc)
      await remoteDB.remove(doc)
      set(state => ({
        agendamentos: state.agendamentos.filter(d => d._id !== _id),
        syncTimestamp: Date.now()
      }))
    } catch (err) {
      console.error('[DataStore] removeAgendamento error:', err)
    }
  },

  // Função para buscar agendamento pelo id_origem
  findAgendamentoByIdOrigem: (id_origem) => {
    const agendamentos = get().agendamentos
    return agendamentos.find(agendamento => agendamento.id_origem === id_origem)
  }

}))

export function useAgendamentos({ revalidateOnFocus = true } = {}) {
  // Seleciona somente o necessário da store (evita rerenders desnecessários)
  const agendamentos = useDataStoreAgendamentos((s) => s.agendamentos);
  const fetchAgendamentos = useDataStoreAgendamentos((s) => s.fetchAgendamentos);

  // Revalida ao montar
  useEffect(() => {
    fetchAgendamentos?.();
  }, [fetchAgendamentos]);

  // (Opcional) Revalidar ao voltar o foco / aba visível
  useEffect(() => {
    if (!revalidateOnFocus) return;

    const onFocus = () => fetchAgendamentos?.();
    const onVis = () => {
      if (document.visibilityState === "visible") onFocus();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [revalidateOnFocus, fetchAgendamentos]);

  // Índice com o registro MAIS RECENTE por id_origem
  const latestById = useMemo(() => {
    const map = new Map();
    for (const a of agendamentos ?? []) {
      const key = a?.id_origem ?? a?._id ?? a?.id;
      if (!key) continue;

      const prev = map.get(key);
      const aTs = +new Date(a?.updated_at ?? a?.created_at ?? 0);
      const pTs = +new Date(prev?.updated_at ?? prev?.created_at ?? 0);
      if (!prev || aTs >= pTs) map.set(key, a);
    }
    return map;
  }, [agendamentos]);

  // Finder que SEMPRE pega o mais novo
  const findAgendamentoByIdOrigem = useCallback(
    (id) => latestById.get(id) ?? null,
    [latestById]
  );

  // Retorna sempre referências atualizadas
  return useMemo(
    () => ({ agendamentos, findAgendamentoByIdOrigem, refetch: fetchAgendamentos }),
    [agendamentos, findAgendamentoByIdOrigem, fetchAgendamentos]
  );
}
