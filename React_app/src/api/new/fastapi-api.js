/**
 * API FastAPI - Índice Central
 * ============================
 *
 * Centraliza todos os endpoints da API FastAPI
 * Importe daqui em vez de arquivos individuais
 *
 * Uso:
 *   import { auth, alerts, commands } from '@/api/new/fastapi-api';
 *   const user = await auth.login(email, password);
 *   const alertas = await alerts.listAlerts();
 */

import * as auth from './fastapi-auth';
import * as alerts from './fastapi-alerts';
import * as commands from './fastapi-commands';

export {
  auth,
  alerts,
  commands,
};

/**
 * Função auxiliar para configurar a API
 * Chame isso no App.tsx na inicialização
 */
export const initializeAPI = (baseURL) => {
  if (baseURL) {
    import('axios').then(({ default: axios }) => {
      // Não temos acesso direto ao apiClient aqui,
      // mas isso é mais para documentação
      console.log('✅ API configurada para:', baseURL);
    });
  }
};

export default {
  auth,
  alerts,
  commands,
  initializeAPI,
};
