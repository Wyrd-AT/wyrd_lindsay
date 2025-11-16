// src/stores/dataStoreIrrigadores.js
import { create } from 'zustand'
import { useEffect, useMemo } from 'react'
import { saveData } from '../../api/old/database_app'
import { localDB, remoteDB } from '../../api/old/database'

export const useDataStoreIrrigadores = create((set, get) => ({
  irrigadores: [],
  syncTimestamp: Date.now(),

  fetchIrrigadores: async (companyId) => {
    try {
      const result = await localDB.find({
        selector: { table: 'irrigadores', companyId }
      })
      set({ irrigadores: result.docs, syncTimestamp: Date.now() })
    } catch (err) {
      console.error('[DataStore] fetchIrrigadores error:', err)
    }
  },

  // agora recebe (payload, companyId)
  addIrrigador: async (payload, companyId) => {
    try {
      const doc = {
        ...payload,
        table: 'irrigadores',
        companyId           // ← injeta aqui
      }
      const { id, rev } = await saveData(doc)
      set(state => ({
        irrigadores: [
          ...state.irrigadores,
          { ...doc, _id: id, _rev: rev }
        ],
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

  removeIrrigador: async (_id) => {
    try {
      const doc = await localDB.get(_id)
      await localDB.remove(doc)
      await remoteDB.remove({ _id: doc._id, _rev: doc._rev })
      set(state => ({
        irrigadores: state.irrigadores.filter(d => d._id !== _id),
        syncTimestamp: Date.now()
      }))
    } catch (err) {
      console.error('[DataStore] removeIrrigador error:', err)
    }
  }
}))

export function useIrrigadores(companyId) {
  const irrigadores = useDataStoreIrrigadores(state => state.irrigadores)
  const fetchIrrigadores = useDataStoreIrrigadores(state => state.fetchIrrigadores)

  useEffect(() => {
    if (companyId) fetchIrrigadores(companyId)
  }, [fetchIrrigadores, companyId])

  return useMemo(() => irrigadores, [irrigadores])
}
