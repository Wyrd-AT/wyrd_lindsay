/**
 * API de Comandos MQTT
 * ====================
 *
 * Funções para enviar e gerenciar comandos para irrigadores/pivôs
 */

import apiClient from './apiClient';

/**
 * ENVIAR COMANDO
 *
 * @param {string} irrigadorId - ID do irrigador
 * @param {string} command - Tipo de comando (start, stop, pause, emergency_stop)
 * @param {Object} params - Parâmetros do comando { duration, flow_rate, etc }
 * @param {string} pivoId - (opcional) ID do pivô específico
 * @param {number} timerMinutes - (opcional) Agendar para depois (0 = agora)
 * @returns {Promise}
 */
export const sendCommand = async (
  irrigadorId,
  command,
  params = {},
  pivoId = '',
  timerMinutes = 0
) => {
  try {
    // Validar comando
    const validCommands = ['start', 'stop', 'pause', 'emergency_stop', 'reset'];
    if (!validCommands.includes(command)) {
      throw new Error(`Comando inválido. Use: ${validCommands.join(', ')}`);
    }

    const response = await apiClient.post('/commands', {
      irrigadorId,
      pivoId,
      command,
      params,
      timer_minutes: timerMinutes,
    });

    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.detail || error.message;
    throw new Error(`Erro ao enviar comando: ${errorMsg}`);
  }
};

/**
 * OBTER STATUS DO COMANDO
 *
 * @param {string} commandId - ID do comando
 * @returns {Promise}
 */
export const getCommand = async (commandId) => {
  try {
    const response = await apiClient.get(`/commands/${commandId}`);
    return response.data;
  } catch (error) {
    throw new Error(`Erro ao obter comando: ${error.message}`);
  }
};

/**
 * LISTAR COMANDOS
 *
 * @param {string} irrigadorId - (opcional) Filtrar por irrigador
 * @param {string} status - (opcional) Filtrar por status (pending, scheduled, published, cancelled)
 * @param {number} limit - Máximo de resultados
 * @returns {Promise}
 */
export const listCommands = async (irrigadorId = null, status = null, limit = 50) => {
  try {
    const params = new URLSearchParams();
    if (irrigadorId) params.append('irrigador_id', irrigadorId);
    if (status) params.append('status', status);
    params.append('limit', limit);

    const response = await apiClient.get(`/commands?${params.toString()}`);
    return response.data;
  } catch (error) {
    throw new Error(`Erro ao listar comandos: ${error.message}`);
  }
};

/**
 * CANCELAR COMANDO
 *
 * @param {string} commandId - ID do comando a cancelar
 * @returns {Promise}
 */
export const cancelCommand = async (commandId) => {
  try {
    const response = await apiClient.put(`/commands/${commandId}/cancel`);
    return response.data;
  } catch (error) {
    const errorMsg = error.response?.data?.detail || error.message;
    throw new Error(`Erro ao cancelar comando: ${errorMsg}`);
  }
};

/**
 * COMANDOS RÁPIDOS (helpers)
 */

export const startPivo = async (irrigadorId, pivoId, duration = 60, flowRate = 80) => {
  return sendCommand(irrigadorId, 'start', { duration, flow_rate: flowRate }, pivoId);
};

export const stopPivo = async (irrigadorId, pivoId) => {
  return sendCommand(irrigadorId, 'stop', {}, pivoId);
};

export const pausePivo = async (irrigadorId, pivoId) => {
  return sendCommand(irrigadorId, 'pause', {}, pivoId);
};

export const emergencyStop = async (irrigadorId, pivoId) => {
  return sendCommand(irrigadorId, 'emergency_stop', {}, pivoId);
};

export const scheduleCommand = async (irrigadorId, command, delayMinutes, params = {}, pivoId = '') => {
  return sendCommand(irrigadorId, command, params, pivoId, delayMinutes);
};

export default {
  sendCommand,
  getCommand,
  listCommands,
  cancelCommand,
  // Quick commands
  startPivo,
  stopPivo,
  pausePivo,
  emergencyStop,
  scheduleCommand,
};
