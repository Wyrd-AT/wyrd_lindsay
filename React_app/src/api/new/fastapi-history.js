/**
 * Cliente Axios para os endpoints de histórico, recente e config de notificações.
 * Substitui o acesso direto ao CouchDB via couch.ts.
 */

import apiClient from './apiClient'

// ============================================================================
// Histórico
// ============================================================================

/**
 * @param {string} irrigadorId
 * @param {{ tipo?: string, start_ts?: string, end_ts?: string, max_points?: number }} params
 */
export const getTensionHistory = (irrigadorId, params = {}) =>
  apiClient.get(`/history/${irrigadorId}/tension`, { params })

/**
 * @param {string} irrigadorId
 * @param {{ event_type?: string, start_ts?: string, end_ts?: string, skip?: number, limit?: number }} params
 */
export const getEventsHistory = (irrigadorId, params = {}) =>
  apiClient.get(`/history/${irrigadorId}/events`, { params })

/**
 * @param {string} irrigadorId
 * @param {{ start_ts?: string, end_ts?: string, skip?: number, limit?: number }} params
 */
export const getSWHistory = (irrigadorId, params = {}) =>
  apiClient.get(`/history/${irrigadorId}/sw`, { params })

/**
 * @param {string} irrigadorId
 * @param {{ start_ts?: string, end_ts?: string, skip?: number, limit?: number }} params
 */
export const getAlertsHistory = (irrigadorId, params = {}) =>
  apiClient.get(`/history/${irrigadorId}/alerts`, { params })

/**
 * @param {{ since?: string, limit?: number, feed?: string, timeout_ms?: number, irrigador_id?: string }} params
 */
export const getChanges = (params = {}) =>
  apiClient.get('/history/changes', { params })

// ============================================================================
// Snapshots recentes
// ============================================================================

/** Retorna tensão (A/B/C/D) + SW atuais do irrigador */
export const getRecentAll = (irrigadorId) =>
  apiClient.get(`/recent/${irrigadorId}`)

/**
 * @param {string} irrigadorId
 * @param {'A'|'B'|'C'|'D'} tipo
 */
export const getRecentTension = (irrigadorId, tipo) =>
  apiClient.get(`/recent/${irrigadorId}/tension/${tipo}`)

export const getRecentSW = (irrigadorId) =>
  apiClient.get(`/recent/${irrigadorId}/sw`)

// ============================================================================
// Configuração de notificações
// ============================================================================

export const getNotificationsConfig = (irrigadorId) =>
  apiClient.get(`/notifications-config/${irrigadorId}`)

/**
 * @param {string} irrigadorId
 * @param {{ email: string, msg_enabled: boolean, call_enabled: boolean }} data
 */
export const updateNotificationsConfig = (irrigadorId, data) =>
  apiClient.put(`/notifications-config/${irrigadorId}`, data)
