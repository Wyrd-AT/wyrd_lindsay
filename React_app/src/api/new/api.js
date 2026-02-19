import axios from 'axios';
import { useAuthStore } from '../../stores/new/authStore';

// FASE 1 - Security: Move sensitive IDs to env variables (Vite)
const COGNITO_BASE_URL = import.meta.env.VITE_COGNITO_BASE_URL || 'https://cognito-idp.sa-east-1.amazonaws.com/sa-east-1_bm329gdfB';
export const COGNITO_CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '42qha79hpnknpksf2k1djo7eq9';

// Warn if using defaults (development only)
if (import.meta.env.MODE === 'development' && !import.meta.env.VITE_COGNITO_CLIENT_ID) {
  console.warn('⚠️ VITE_COGNITO_CLIENT_ID not set, using development default');
}

const api = axios.create({
    baseURL: COGNITO_BASE_URL,
    headers: {
    'Content-Type': 'application/x-amz-json-1.1',
  },
})

// Interceptador de requisição para incluir o token JWT no cabeçalho
// Não adiciona token em requisições de autenticação
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  // Apenas adiciona Authorization se não for uma requisição de autenticação
  const authTargets = ['SignUp', 'ConfirmSignUp', 'InitiateAuth', 'ForgotPassword', 'ConfirmForgotPassword'];
  const xAmzTarget = config.headers['X-Amz-Target'] || '';
  const isAuthRequest = authTargets.some(target => xAmzTarget.includes(target));

  if (token && !isAuthRequest) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export const home = {
  check: () => api.get('/home'),
};

export default api