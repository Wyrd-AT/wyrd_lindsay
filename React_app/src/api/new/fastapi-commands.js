/**
 * API de Comandos MQTT
 * Substitui o acesso direto ao CouchDB via messageStore.postMessage()
 */

import apiClient from "./apiClient";

/**
 * Envia um comando para um irrigador via backend.
 * O backend monta topic/payload no formato que o Python MQTT (Lindsay_comandos.py) lê.
 *
 * @param {object} opts
 * @param {string} opts.irrigadorId   - ID do irrigador (ex: "irrigador:WEGPOC")
 * @param {string} opts.command       - Comando bruto (ex: "SendOFF", "ack")
 * @param {string} [opts.monitor]     - Número do monitor (ex: "17") — concatenado ao payload
 * @param {number} [opts.timerMinutes=0] - 0 = imediato, >0 = agendado
 * @param {string} [opts.timerRef]    - Referência ao doc de timer ("timer:{alertId}:current")
 * @returns {Promise<{ success: boolean, doc_id: string, status: string }>}
 */
export async function postCommand({ irrigadorId, command, monitor = null, timerMinutes = 0, timerRef = null }) {
  const response = await apiClient.post("/commands", {
    irrigador_id: irrigadorId,
    command,
    monitor: monitor ?? undefined,
    timer_minutes: timerMinutes,
    timer_ref: timerRef ?? undefined,
  });
  return response.data;
}

export default { postCommand };
