/**
 * API Client para Lindsay FastAPI
 * ================================
 *
 * Cliente HTTP centralizado para comunicação com a API FastAPI.
 * Autenticação via Bearer token (Base64(email:type))
 */

import axios from "axios";
import { useAuthStore } from "../../stores/new/authStore";

// URL base da API (variavelmente via env)
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

// Criar instância do axios com config base
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Interceptor de REQUEST:
 * - Adiciona token de autenticação no header
 * - Formata erros de forma consistente
 */
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;

    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

/**
 * Interceptor de RESPONSE:
 * - Trata erros comuns (401, 403, 500)
 * - Log estruturado de erros
 */
// Flag para evitar múltiplos redirects simultâneos
let isRedirecting = false;

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Se 401 (não autorizado), limpar token e redirecionar para login
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = "/";
    }

    // 403 com códigos específicos de onboarding (NÃO fazer logout)
    if (error.response?.status === 403 && !isRedirecting) {
      const detail = error.response?.data?.detail;

      if (detail === "email_not_verified") {
        isRedirecting = true;
        window.location.href = "/verify-email";
        setTimeout(() => { isRedirecting = false; }, 2000);
        return Promise.reject(error);
      }

      if (detail === "terms_not_accepted") {
        isRedirecting = true;
        window.location.href = "/accept-terms";
        setTimeout(() => { isRedirecting = false; }, 2000);
        return Promise.reject(error);
      }

      if (detail === "account_pending") {
        isRedirecting = true;
        window.location.href = "/account-pending";
        setTimeout(() => { isRedirecting = false; }, 2000);
        return Promise.reject(error);
      }

      if (detail === "account_rejected") {
        useAuthStore.getState().logout();
        window.location.href = "/?error=account_rejected";
        return Promise.reject(error);
      }
    }

    // Log de erro estruturado
    if (error.response?.status === 500) {
      console.error("❌ Erro servidor 500:", {
        url: error.config?.url,
        status: error.response?.status,
        data: error.response?.data,
      });
    }

    return Promise.reject(error);
  },
);

export default apiClient;
