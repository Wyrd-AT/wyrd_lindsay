/**
 * Store de irrigadores via FastAPI — sem acesso direto ao CouchDB.
 * CRUD via /api/pivos (os endpoints já filtram por role do usuário autenticado).
 */
import { useEffect, useMemo } from 'react'
import { create } from 'zustand'
import apiClient from '../../api/new/apiClient'

export const useDataStoreIrrigadores = create((set) => ({
  irrigadores: [],
  syncTimestamp: 0,
  recentSyncTimestamp: 0,
  isLoading: false,
  isLoadingRecent: false,
  error: null,
  recentError: null,

  /**
   * Status recente por irrigador, atualizado individualmente pelo listener.
   * { [irrigadorId]: { alarm_count, last_alert_date, ... } }
   */
  recentOverrides: {},
  resetIrrigadores: () =>
    set({
      irrigadores: [],
      syncTimestamp: 0,
      recentSyncTimestamp: 0,
      isLoading: false,
      isLoadingRecent: false,
      error: null,
      recentError: null,
      recentOverrides: {},
    }),

  /**
   * Busca irrigadores com dados recentes embutidos (alarm_count, last_alert_date).
   * O backend filtra por role automaticamente e ordena por alarm_count DESC.
   */
  fetchIrrigadores: async (options = {}) => {
    const { force = false, maxAgeMs = 60000 } = options
    const state = useDataStoreIrrigadores.getState()
    const hasData = Array.isArray(state.irrigadores) && state.irrigadores.length > 0
    if (!force && hasData && state.syncTimestamp && Date.now() - state.syncTimestamp < maxAgeMs) {
      return
    }
    set({ isLoading: true, error: null })
    try {
      const response = await apiClient.get('/pivos')
      const pivos = response.data?.pivos || []
      set({ irrigadores: pivos, syncTimestamp: Date.now(), isLoading: false })
    } catch (err) {
      set({ error: err?.message || 'Erro ao buscar irrigadores', isLoading: false })
    }
  },

  /**
   * Busca status recente leve (alarm_count, last_data_at) em batch.
   */
  fetchRecentIrrigadores: async (options = {}) => {
    const { force = false, maxAgeMs = 30000 } = options
    const state = useDataStoreIrrigadores.getState()
    const lastRecent = state.recentSyncTimestamp || 0
    const hasData = Array.isArray(state.irrigadores) && state.irrigadores.length > 0
    if (!force && hasData && lastRecent && Date.now() - lastRecent < maxAgeMs) {
      return
    }
    set({ isLoadingRecent: true, recentError: null })
    try {
      const response = await apiClient.get('/pivos/recent')
      const recents = response.data?.recents || []
      set((state) => {
        const merged = state.irrigadores.map((p) => {
          const r = recents.find((x) => x._id === (p._id || p.id))
          return r ? { ...p, ...r } : p
        })
        return {
          irrigadores: merged,
          syncTimestamp: Date.now(),
          recentSyncTimestamp: Date.now(),
          isLoadingRecent: false,
        }
      })
    } catch (err) {
      // mantém silencioso para não travar UI
      set({
        recentError: err?.message || 'Erro ao buscar status recente',
        isLoadingRecent: false,
      })
    }
  },

  /**
   * Atualiza o status recente de um único irrigador (chamado pelo listener de mudanças).
   * Só o card desse irrigador re-renderiza (com React.memo).
   */
  updateRecentForIrrigador: (id, overview) =>
    set((state) => ({
      recentOverrides: { ...state.recentOverrides, [id]: overview },
    })),

  addIrrigador: async (payload, cnpjCliente) => {
    try {
      const body = { ...payload, cliente_id: cnpjCliente }
      const response = await apiClient.post('/pivos', body)
      const newPivo = response.data
      set((state) => ({
        irrigadores: [...state.irrigadores, newPivo],
        syncTimestamp: Date.now(),
      }))
      return { id: newPivo._id || newPivo.id, rev: null }
    } catch (err) {
      throw err
    }
  },

  updateIrrigador: async (_id, updates) => {
    try {
      await apiClient.put(`/pivos/${encodeURIComponent(_id)}`, updates)
      set((state) => ({
        irrigadores: state.irrigadores.map((doc) =>
          doc._id === _id || doc.id === _id ? { ...doc, ...updates } : doc
        ),
        syncTimestamp: Date.now(),
      }))
      return { id: _id, rev: null }
    } catch (err) {
      throw err
    }
  },

  removeIrrigador: async (_id) => {
    try {
      await apiClient.delete(`/pivos/${encodeURIComponent(_id)}`)
      set((state) => ({
        irrigadores: state.irrigadores.filter(
          (d) => d._id !== _id && d.id !== _id
        ),
        syncTimestamp: Date.now(),
      }))
    } catch (err) {
      throw err
    }
  },
}))

/**
 * Hook para listar irrigadores.
 * O backend filtra automaticamente pelo role do usuário autenticado.
 */
export function useIrrigadores() {
  const irrigadores = useDataStoreIrrigadores((s) => s.irrigadores)
  const fetchIrrigadores = useDataStoreIrrigadores((s) => s.fetchIrrigadores)
  const fetchRecentIrrigadores = useDataStoreIrrigadores((s) => s.fetchRecentIrrigadores)

  useEffect(() => {
    fetchIrrigadores()
    const t = setTimeout(() => {
      fetchRecentIrrigadores()
    }, 800)
    return () => clearTimeout(t)
  }, [fetchIrrigadores, fetchRecentIrrigadores])

  return useMemo(() => irrigadores, [irrigadores])
}
