/**
 * API de Timers (agendamentos de alertas)
 * Substitui useAgendamentos.js + acesso direto ao CouchDB
 */

import apiClient from "./apiClient";

const encode = (id) => encodeURIComponent(id);

/**
 * Lê o estado atual do timer para um alerta.
 * @returns {Promise<object|null>}
 */
export async function getTimer(alertId) {
  const res = await apiClient.get(`/timers/${encode(alertId)}`);
  return res.data ?? null;
}

/**
 * Cria ou atualiza o estado atual do timer.
 * @param {string} alertId
 * @param {object} patch - campos a atualizar
 */
export async function upsertTimer(alertId, patch) {
  const res = await apiClient.put(`/timers/${encode(alertId)}`, patch);
  return res.data;
}

/**
 * Appenda um evento ao histórico mensal do timer.
 * @param {string} alertId
 * @param {{ type, at, by, timer_value?, scheduled_for?, related?, note? }} event
 */
export async function appendTimerEvent(alertId, event) {
  const res = await apiClient.post(`/timers/${encode(alertId)}/events`, event);
  return res.data;
}

/**
 * Retorna todos os eventos históricos do timer (todos os meses).
 * @returns {Promise<{ alert_id: string, events: object[] }>}
 */
export async function getTimerHistory(alertId) {
  const res = await apiClient.get(`/timers/${encode(alertId)}/history`);
  return res.data;
}
