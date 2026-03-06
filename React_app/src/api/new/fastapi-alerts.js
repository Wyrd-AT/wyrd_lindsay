/**
 * API de Alertas e Notificações
 * =============================
 *
 * Funções para gerenciar alertas, notificações push e envio de mensagens
 */

import apiClient from "./apiClient";

/**
 * LISTAR ALERTAS
 *
 * @param {string} irrigadorId - (opcional) Filtrar por irrigador
 * @param {number} limit - Máximo de resultados
 * @returns {Promise}
 */
export const listAlerts = async (irrigadorId = null, limit = 50) => {
  try {
    const params = new URLSearchParams();
    if (irrigadorId) params.append("irrigador_id", irrigadorId);
    params.append("limit", limit);

    const response = await apiClient.get(`/alerts?${params.toString()}`);
    return response.data;
  } catch (error) {
    throw new Error(`Erro ao listar alertas: ${error.message}`);
  }
};

/**
 * OBTER DETALHES DO ALERTA
 *
 * @param {string} alertId - ID do alerta
 * @returns {Promise}
 */
export const getAlert = async (alertId) => {
  try {
    const response = await apiClient.get(`/alerts/${alertId}`);
    return response.data;
  } catch (error) {
    throw new Error(`Erro ao obter alerta: ${error.message}`);
  }
};

/**
 * ENVIAR NOTIFICAÇÕES MANUAIS
 * (SMS, WhatsApp, Email)
 *
 * @param {string} message - Mensagem a enviar
 * @param {Array<string>} phones - Lista de telefones (+5511999999999)
 * @param {Array<string>} emails - Lista de emails
 * @param {Array<string>} channels - Canais (sms, whatsapp, email)
 * @returns {Promise}
 */
export const sendNotification = async (
  message,
  phones = [],
  emails = [],
  channels = ["sms", "whatsapp", "email"],
) => {
  try {
    const response = await apiClient.post("/alerts/notifications/send", {
      message,
      subject: "Notificação do Sistema Lindsay",
      phones,
      emails,
      channels,
    });

    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.detail || error.message;
    throw new Error(`Erro ao enviar notificação: ${errorMsg}`);
  }
};

/**
 * REGISTRAR DEVICE TOKEN PARA PUSH NOTIFICATIONS
 *
 * @param {string} deviceToken - Token Expo Push (ExponentPushToken[...])
 * @param {Object} deviceInfo - Info do device (model, os)
 * @returns {Promise}
 */
export const registerDeviceToken = async (deviceToken, deviceInfo = {}) => {
  try {
    const response = await apiClient.post("/alerts/push/register-device", {
      device_token: deviceToken,
      device_info: deviceInfo,
    });

    return response.data;
  } catch (error) {
    throw new Error(`Erro ao registrar device: ${error.message}`);
  }
};

/**
 * DESREGISTRAR DEVICE TOKEN
 *
 * @param {string} deviceToken - Token a desregistrar
 * @returns {Promise}
 */
export const unregisterDeviceToken = async (deviceToken) => {
  try {
    const response = await apiClient.post("/alerts/push/unregister-device", {
      device_token: deviceToken,
    });

    return response.data;
  } catch (error) {
    throw new Error(`Erro ao desregistrar device: ${error.message}`);
  }
};

/**
 * OBTER HISTÓRICO DE NOTIFICAÇÕES PUSH
 *
 * @param {string} irrigadorId - (opcional) ID do irrigador
 * @param {number} limit - Máximo de resultados
 * @returns {Promise}
 */
export const getNotificationHistory = async (
  irrigadorId = null,
  limit = 50,
) => {
  try {
    const params = new URLSearchParams();
    if (irrigadorId) params.append("irrigador_id", irrigadorId);
    params.append("limit", limit);

    const response = await apiClient.get(
      `/alerts/push/notifications-history?${params.toString()}`,
    );

    return response.data;
  } catch (error) {
    throw new Error(`Erro ao obter histórico: ${error.message}`);
  }
};

export default {
  listAlerts,
  getAlert,
  sendNotification,
  registerDeviceToken,
  unregisterDeviceToken,
  getNotificationHistory,
};
