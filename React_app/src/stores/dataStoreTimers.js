import { create } from 'zustand'
import { useEffect, useMemo } from 'react'
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

export function useAgendamentos() {
  const agendamentos = useDataStoreAgendamentos(state => state.agendamentos)
  const fetchAgendamentos = useDataStoreAgendamentos(state => state.fetchAgendamentos)
  const findAgendamentoByIdOrigem = useDataStoreAgendamentos(state => state.findAgendamentoByIdOrigem)

  useEffect(() => {
    fetchAgendamentos()
  }, [fetchAgendamentos])

  return useMemo(() => ({ agendamentos, findAgendamentoByIdOrigem }), [agendamentos])
}
