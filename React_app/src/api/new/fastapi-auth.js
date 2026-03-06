/**
 * Autenticação FastAPI
 * ====================
 *
 * Integração com a nova API FastAPI (Lindsay v2.0)
 * Autenticação simples: Base64(email:type)
 */

import apiClient from "./apiClient";
import { useAuthStore } from "../../stores/new/authStore";

/**
 * Criar token em formato Base64(email:type)
 * Ex: Base64("user@example.com:cliente") = "dXNlckBleGFtcGxlLmNvbTpjbGllbnRl"
 */
const createToken = (email, type) => {
  const tokenString = `${email}:${type}`;
  return btoa(tokenString); // Base64 encode
};

/**
 * Decodificar token para extrair email e type
 */
const decodeToken = (token) => {
  try {
    const decoded = atob(token);
    const [email, type] = decoded.split(":");
    return { email, type };
  } catch (error) {
    console.error("Erro ao decodificar token:", error);
    return { email: "", type: "" };
  }
};

/**
 * REGISTER - Criar novo usuário
 *
 * @param {string} email - Email do usuário
 * @param {string} password - Senha
 * @param {string} name - Nome completo
 * @param {string} type - Tipo (admin, revenda, cliente)
 * @returns {Promise}
 */
export const register = async (email, password, name, type = "cliente") => {
  try {
    const response = await apiClient.post("/auth/register", {
      email,
      password,
      name,
      type,
      domain: type === "revenda" ? email.split("@")[1] : undefined, // Para revendas
    });

    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || `Erro ao registrar: ${error.message}`,
    );
  }
};

/**
 * LOGIN - Autenticar usuário
 *
 * @param {string} email - Email do usuário
 * @param {string} password - Senha
 * @returns {Promise} - Retorna token e dados do usuário
 */
export const login = async (email, password) => {
  try {
    const response = await apiClient.post("/auth/login", {
      email,
      password,
    });

    const { access_token, user } = response.data;

    // O token já vem do backend, vamos armazenar
    useAuthStore.getState().login(user, access_token);

    return {
      token: access_token,
      user,
    };
  } catch (error) {
    const errorMsg =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message;

    throw new Error(`Erro ao fazer login: ${errorMsg}`);
  }
};

/**
 * GET CURRENT USER - Obter dados do usuário autenticado
 *
 * @returns {Promise}
 */
export const getCurrentUser = async () => {
  try {
    const response = await apiClient.get("/auth/me");
    return response.data;
  } catch (error) {
    throw new Error(`Erro ao obter usuário atual: ${error.message}`);
  }
};

/**
 * LOGOUT - Limpar autenticação (local apenas)
 */
export const logout = () => {
  useAuthStore.getState().logout();
};

/**
 * Verificar se usuário está autenticado
 */
export const isAuthenticated = () => {
  return useAuthStore.getState().token !== null;
};

/**
 * Obter tipo do usuário (admin, revenda, cliente)
 */
export const getUserType = () => {
  const token = useAuthStore.getState().token;
  if (!token) return null;

  const { type } = decodeToken(token);
  return type;
};

/**
 * Obter email do usuário
 */
export const getUserEmail = () => {
  const token = useAuthStore.getState().token;
  if (!token) return null;

  const { email } = decodeToken(token);
  return email;
};

export default {
  register,
  login,
  logout,
  getCurrentUser,
  isAuthenticated,
  getUserType,
  getUserEmail,
  decodeToken,
  createToken,
};
