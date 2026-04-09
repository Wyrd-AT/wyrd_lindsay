import { useAuthStore } from "../stores/new/authStore";
import apiClient from "./new/apiClient";

// Serviço para criar um usuário (sign-up)
export const signUp = async (email, password, customAttributes = {}) => {
  try {
    const payload = {
      email,
      password,
      name: customAttributes.name,
      phone_number: customAttributes.phone_number,
      type: customAttributes.type,
      status: customAttributes.status,
      domain: customAttributes.domain,
      cnpj: customAttributes.cnpj,
      hierarquia: customAttributes.hierarquia,
    };

    const response = await apiClient.post("/auth/signup", payload);
    return response.data;
  } catch (error) {
    throw new Error(
      `Erro ao registrar usuário: ${error.response?.data?.detail || error.message}`,
    );
  }
};

/**
 * Registrar uma nova revenda (fluxo completo: Cognito + CouchDB)
 *
 * @param {string} email - Email da revenda
 * @param {string} password - Senha
 * @param {string} name - Nome da revenda
 * @param {string} domain - Domínio (ex: wyrd.com.br)
 * @param {string} cnpj - CNPJ (formato: XX.XXX.XXX/0001-XX)
 * @param {string} phoneNumber - CNPJ (formato: +5511999999999)
 * @returns {Promise<Object>} Resposta do backend
 */
export const registerRevenda = async (
  email,
  password,
  name,
  domain,
  cnpj,
  phoneNumber,
) => {
  try {
    // O apiClient já utiliza a VITE_API_BASE_URL e inclui o prefixo /api
    // O endpoint final será: http://seu-ip/api/auth/register
    const response = await apiClient.post("/auth/register", {
      email,
      password,
      name,
      user_type: "revenda",
      domain,
      cnpj,
      phone_number: phoneNumber,
    });

    // No Axios, os dados retornados pelo servidor ficam em .data
    return response.data;
  } catch (error) {
    console.error("❌ Erro ao registrar revenda:", error);

    // Captura a mensagem de erro detalhada vinda do backend (FastAPI) através do Axios
    const errorMessage =
      error.response?.data?.detail ||
      error.message ||
      "Falha ao registrar revenda. Por favor, tente novamente.";

    throw new Error(errorMessage);
  }
};

// Serviço para confirmar o e-mail após o cadastro
export const confirmSignUp = async (email, confirmationCode) => {
  try {
    const response = await apiClient.post("/auth/verify-email", {
      email,
      code: confirmationCode,
    });
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || `Erro ao confirmar e-mail: ${error.message}`,
    );
  }
};

// Serviço para reenviar código de confirmação
export const resendConfirmationCode = async (email) => {
  try {
    const response = await apiClient.post("/auth/resend-code", { email });
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.detail || `Erro ao reenviar código: ${error.message}`,
    );
  }
};

// Serviço para autenticar o usuário (sign-in via FastAPI → Cognito → CouchDB)
export const signIn = async (email, password) => {
  try {
    const response = await apiClient.post("/auth/login-cognito", {
      email,
      password,
    });

    const {
      access_token,
      user,
      email_verified,
      terms_accepted,
      terms_version,
      requires_action,
    } = response.data;

    useAuthStore.getState().login(
      {
        email: user.email,
        name: user.name,
        phone_number: user.phone_number,
        type: user.type,
        status: user.status,
        doc_id: user.doc_id,
        sub_role: user.sub_role,
        cnpj: user.cnpj,
        email_verified,
        terms_accepted,
        terms_version,
        requires_action,
      },
      access_token,
    );

    return response.data;
  } catch (error) {
    const detail = error.response?.data?.detail;
    if (detail && error.response?.status === 401) {
      if (detail.includes("não confirmada") || detail.includes("NotConfirmed")) {
        throw Object.assign(new Error(detail), { notConfirmed: true });
      }
      throw new Error(detail);
    }
    throw new Error(detail || error.message);
  }
};

// Serviço para iniciar o fluxo de "Esqueci a Senha"
export const forgotPassword = async (email) => {
  try {
    const response = await apiClient.post("/auth/forgot-password", { email });
    return response.data; // Resposta pode incluir detalhes sobre como proceder
  } catch (error) {
    throw new Error(
      `Erro ao iniciar fluxo de recuperação de senha: ${error.response?.data?.detail || error.message}`,
    );
  }
};

// Serviço para confirmar a nova senha no fluxo de "Esqueci a Senha"
export const confirmForgotPassword = async (
  email,
  confirmationCode,
  newPassword,
) => {
  try {
    const response = await apiClient.post("/auth/confirm-forgot-password", {
      email,
      code: confirmationCode,
      new_password: newPassword,
    });
    return response.data;
  } catch (error) {
    throw new Error(
      `Erro ao redefinir senha: ${error.response?.data?.detail || error.message}`,
    );
  }
};

// Serviço para trocar senha com o usuário autenticado
export const changePassword = async (
  accessToken,
  previousPassword,
  proposedPassword,
) => {
  try {
    const response = await apiClient.post(
      "/auth/change-password",
      {
        previous_password: previousPassword,
        proposed_password: proposedPassword,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    return response.data;
  } catch (error) {
    throw new Error(
      `Erro ao trocar senha: ${error.response?.data?.detail || error.message}`,
    );
  }
};
