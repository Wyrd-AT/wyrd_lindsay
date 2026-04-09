/**
 * Store de cache para dados hierárquicos (admins, revendas, clientes).
 * TTL de 5 minutos — evita fetches repetidos ao abrir o modal múltiplas vezes.
 */
import { create } from 'zustand'
import apiClient from '../../api/new/apiClient'

const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

export const useHierarchyStore = create((set, get) => ({
  admins: [],
  adminsFetchedAt: 0,
  loadingAdmins: false,

  revendas: [],
  revendasFetchedAt: 0,
  loadingRevendas: false,

  clientes: [],
  clientesFetchedAt: 0,
  loadingClientes: false,

  /**
   * Busca lista de admins (apenas superadmin tem acesso).
   * Usa cache de 5 min — não refaz o request se os dados ainda forem frescos.
   */
  fetchAdmins: async () => {
    const { adminsFetchedAt, loadingAdmins } = get()
    if (loadingAdmins) return
    if (Date.now() - adminsFetchedAt < CACHE_TTL) return
    set({ loadingAdmins: true })
    try {
      const res = await apiClient.get('/admins')
      set({
        admins: res.data?.admins || [],
        adminsFetchedAt: Date.now(),
        loadingAdmins: false,
      })
    } catch {
      set({ loadingAdmins: false })
    }
  },

  /**
   * Busca lista de revendas.
   * Usa cache de 5 min.
   */
  fetchRevendas: async () => {
    const { revendasFetchedAt, loadingRevendas } = get()
    if (loadingRevendas) return
    if (Date.now() - revendasFetchedAt < CACHE_TTL) return
    set({ loadingRevendas: true })
    try {
      const res = await apiClient.get('/revendas')
      set({
        revendas: res.data?.revendas || [],
        revendasFetchedAt: Date.now(),
        loadingRevendas: false,
      })
    } catch {
      set({ loadingRevendas: false })
    }
  },

  /**
   * Busca lista de clientes.
   * Usa cache de 5 min.
   */
  fetchClientes: async () => {
    const { clientesFetchedAt, loadingClientes } = get()
    if (loadingClientes) return
    if (Date.now() - clientesFetchedAt < CACHE_TTL) return
    set({ loadingClientes: true })
    try {
      const res = await apiClient.get('/clientes')
      set({
        clientes: res.data?.clientes || [],
        clientesFetchedAt: Date.now(),
        loadingClientes: false,
      })
    } catch {
      set({ loadingClientes: false })
    }
  },

  /** Invalida o cache (útil após criar/editar hierarquia) */
  invalidateCache: () =>
    set({ adminsFetchedAt: 0, revendasFetchedAt: 0, clientesFetchedAt: 0 }),
}))
