// useDataStoreIrrigadores.ts
import { create } from 'zustand'
import { useEffect, useMemo } from 'react'
import { saveData } from '../api/database_app'
import { localDB, remoteDB } from '../api/database'  // <- agora também importe remoteDB

export const useDataStoreIrrigadores = create((set, get) => ({
  irrigadores: [] ,
  syncTimestamp: Date.now(),

  fetchIrrigadores: async () => {
    try {
      const result = await localDB.find({ selector: { table: 'irrigadores' } })
      set({ irrigadores: result.docs, syncTimestamp: Date.now() })
    } catch (err) {
      console.error('[DataStore] fetchIrrigadores error:', err)
    }
  },

  addIrrigador: async payload => {
    try {
      const { id, rev } = await saveData(payload)
      set(state => ({
        irrigadores: [...state.irrigadores, { ...payload, _id: id, _rev: rev }],
        syncTimestamp: Date.now()
      }))
    } catch (err) {
      console.error('[DataStore] addIrrigador error:', err)
    }
  },

  updateIrrigador: async (_id, updates) => {
    try {
      const existing = await localDB.get(_id)
      const toSave = { ...existing, ...updates, _id }
      const { id, rev } = await saveData(toSave)
      set(state => ({
        irrigadores: state.irrigadores.map(doc =>
          doc._id === id ? { ...doc, ...updates, _rev: rev } : doc
        ),
        syncTimestamp: Date.now()
      }))
    } catch (err) {
      console.error('[DataStore] updateIrrigador error:', err)
    }
  },

  removeIrrigador: async _id => {
    try {
      const doc = await localDB.get(_id)
      // 1) remove local
      await localDB.remove(doc)
      // 2) remove remoto
      await remoteDB.remove({ _id: doc._id, _rev: doc._rev })
      // 3) atualiza estado
      set(state => ({
        irrigadores: state.irrigadores.filter(d => d._id !== _id),
        syncTimestamp: Date.now()
      }))
    } catch (err) {
      console.error('[DataStore] removeIrrigador error:', err)
    }
  }
}))

export function useIrrigadores() {
  const irrigadores = useDataStoreIrrigadores(state => state.irrigadores)
  const fetchIrrigadores = useDataStoreIrrigadores(state => state.fetchIrrigadores)

  useEffect(() => {
    fetchIrrigadores()
  }, [fetchIrrigadores])

  const irrigadoresFiltrados = useMemo(
    () => irrigadores.filter(doc => doc.table === 'irrigadores'),
    [irrigadores]
  )

  return irrigadoresFiltrados
}
