import axios from 'axios';
import { useAuthStore } from '../../stores/old/authStore';

const COGNITO_BASE_URL = 'https://cognito-idp.sa-east-1.amazonaws.com/';
export const COGNITO_CLIENT_ID = '2smqfkuv4iu3d0lb65g7kgd24k';

const api = axios.create({
    baseURL: COGNITO_BASE_URL,
    headers: {
    'Content-Type': 'application/x-amz-json-1.1',
  },
})

// Interceptador de requisição para incluir o token JWT no cabeçalho
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
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