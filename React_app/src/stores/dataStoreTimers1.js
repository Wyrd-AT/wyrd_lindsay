import { create } from 'zustand'
import { useEffect, useMemo } from 'react'
import { saveData } from '../api/database_app'
import { localDB, remoteDB } from '../api/database'

export const useDataStoreManutecoes= create((set, get) => ({
  manutecoes: [],
  syncTimestamp: Date.now(),

  fetchManutecoes: async () => {
    try {
      const result = await localDB.find({
        selector: { table: 'manutencao' }
      })
      set({ manutecoes: result.docs, syncTimestamp: Date.now() })
    } catch (err) {
      console.error('[DataStore] fetchManutecoeserror:', err)
    }
  },

  addManutecao: async (payload) => {
    try {
      const doc = {
        ...payload,
        table: 'manutencao',
      }
      console.log("salvando")
      const { id, rev } = await saveData(doc)
      set(state => ({
        manutecoes: [
          ...state.manutecoes,
          { ...doc, _id: id, _rev: rev }
        ],
        syncTimestamp: Date.now()
      }))
    } catch (err) {
      console.error('[DataStore] addManutecao error:', err)
    }
  },

  updateManutecao: async (_id, updates) => {
    try {
      const existing = await localDB.get(_id)
      const toSave = { ...existing, ...updates, _id }
      const { id, rev } = await saveData(toSave)
      set(state => ({
        manutecoes: state.manutecoes.map(doc =>
          doc._id === id ? { ...doc, ...updates, _rev: rev } : doc
        ),
        syncTimestamp: Date.now()
      }))
    } catch (err) {
      console.error('[DataStore] updateManutecao error:', err)
    }
  },

  removeManutecao: async (_id) => {
    try {
      const doc = await localDB.get(_id)
      await localDB.remove(doc)
      await remoteDB.remove(doc)
      set(state => ({
        manutecoes: state.manutecoes.filter(d => d._id !== _id),
        syncTimestamp: Date.now()
      }))
    } catch (err) {
      console.error('[DataStore] removeManutecao error:', err)
    }
  },

  // Função para buscar Manutecao pelo id_origem
  findManutecaoByIdOrigem: (irrigador) => {
    const manutecoes= get().manutecoes
    return manutecoes.find(manutecao => manutecao.irrigador === irrigador)
  }

}))

export function useManutecoes() {
  const manutecoes= useDataStoreManutecoes(state => state.manutecoes)
  const fetchManutecoes= useDataStoreManutecoes(state => state.fetchManutecoes)
  const findManutecaoByIdOrigem = useDataStoreManutecoes(state => state.findManutecaoByIdOrigem)

  useEffect(() => {
    fetchManutecoes()
  }, [fetchManutecoes])

  return useMemo(() => ({ manutecoes, findManutecaoByIdOrigem }), [manutecoes])
}
 