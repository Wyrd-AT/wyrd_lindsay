import { useAuthStore } from "../../stores/new/authStore.ts";
import api, { COGNITO_CLIENT_ID } from "./api";
import { getDoc, COUCH_USERS_DB } from "./couch";
import apiClient from "./apiClient"; // 👈 Ajuste o caminho para o seu arquivo apiClient.js

// Função auxiliar para decodificar JWT
const decodeToken = (token) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join(""),
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("Erro ao decodificar token:", error);
    return {};
  }
};

// Serviço para criar um usuário (sign-up)
export const signUp = async (email, password, customAttributes = {}) => {
  try {
    // Atributos padrão do Cognito (sempre disponíveis)
    const userAttributes = [
      {
        Name: "email",
        Value: email,
      },
    ];

    // Adicionar atributos padrão (não customizados)
    if (customAttributes.name) {
      userAttributes.push({
        Name: "name",
        Value: customAttributes.name,
      });
    }
    if (customAttributes.phone_number) {
      userAttributes.push({
        Name: "phone_number",
        Value: customAttributes.phone_number,
      });
    }

    // ⚠️ ATENÇÃO: Custom attributes (custom:*) só podem ser enviados se estiverem
    // configurados no User Pool do Cognito. Se não estiverem configurados, o signUp falhará.
    // Por enquanto, não enviamos custom attributes no signUp.
    // Eles devem ser configurados depois via AdminUpdateUserAttributes ou no console AWS.

    // NOTA: Se os custom attributes estiverem configurados no Cognito, descomente abaixo:
    /*
    if (customAttributes.type) {
      userAttributes.push({
        Name: 'custom:type',
        Value: customAttributes.type,
      });
    }
    if (customAttributes.status) {
      userAttributes.push({
        Name: 'custom:status',
        Value: customAttributes.status,
      });
    }
    if (customAttributes.domain) {
      userAttributes.push({
        Name: 'custom:domain',
        Value: customAttributes.domain,
      });
    }
    if (customAttributes.cnpj) {
      userAttributes.push({
        Name: 'custom:cnpj',
        Value: customAttributes.cnpj,
      });
    }
    if (customAttributes.hierarquia) {
      userAttributes.push({
        Name: 'custom:hierarquia',
        Value: customAttributes.hierarquia,
      });
    }
    if (customAttributes.cnpjCliente) {
      userAttributes.push({
        Name: 'custom:cnpj',
        Value: customAttributes.cnpjCliente,
      });
    }
    */

    const payload = {
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: userAttributes,
    };

    const response = await api.post("/", payload, {
      headers: {
        "X-Amz-Target": "AWSCognitoIdentityProviderService.SignUp",
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(
      `Erro ao registrar usuário: ${error.response.data.message}`,
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
    const payload = {
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      ConfirmationCode: confirmationCode,
    };

    const response = await api.post("/", payload, {
      headers: {
        "X-Amz-Target": "AWSCognitoIdentityProviderService.ConfirmSignUp",
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Erro ao confirmar e-mail: ${error.message}`);
  }
};

// Serviço para reenviar código de confirmação
export const resendConfirmationCode = async (email) => {
  try {
    const payload = {
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
    };

    const response = await api.post("/", payload, {
      headers: {
        "X-Amz-Target":
          "AWSCognitoIdentityProviderService.ResendConfirmationCode",
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Erro ao reenviar código: ${error.message}`);
  }
};

// Serviço para autenticar o usuário (sign-in)
export const signIn = async (email, password) => {
  try {
    //console.log('\n🔐 ===== INICIANDO AUTENTICAÇÃO =====');
    //console.log('Email:', email);
    //console.log('Password length:', password.length);
    //console.log('CLIENT_ID:', COGNITO_CLIENT_ID);

    const authParameters = {
      USERNAME: email,
      PASSWORD: password,
    };

    const payload = {
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: authParameters,
    };

    //console.log('\n📦 Payload enviado para Cognito:');
    // console.log(JSON.stringify({
    //   AuthFlow: payload.AuthFlow,
    //   ClientId: payload.ClientId,
    //   AuthParameters: {
    //     USERNAME: authParameters.USERNAME,
    //     PASSWORD: '***REDACTED***',
    //     SECRET_HASH: authParameters.SECRET_HASH ? authParameters.SECRET_HASH.substring(0, 20) + '...' : 'undefined'
    //   }
    // }, null, 2));

    const response = await api.post("/", payload, {
      headers: {
        "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
      },
    });
    //console.log('✅ Resposta completa do Cognito:');
    //console.log('response.data:', response.data);
    //console.log('AuthenticationResult:', response.data.AuthenticationResult);

    const { AccessToken, IdToken } = response.data.AuthenticationResult;

    //console.log('AccessToken:', AccessToken);
    //console.log('IdToken:', IdToken);

    // Decodificar o IdToken para extrair atributos do usuário
    const tokenPayload = decodeToken(IdToken);

    //console.log('🔐 Token Payload (atributos do usuário):');
    //console.log('tokenPayload:', tokenPayload);

    const userEmail = tokenPayload.email || email;

    //console.log('🔍 DEBUG - Procurando custom:type no token:');
    //console.log('   custom:type:', tokenPayload['custom:type']);
    //console.log('   cognito:groups:', tokenPayload['cognito:groups']);

    // Extrair tipo do usuário (custom:type do Cognito ou inferir)
    let userType =
      tokenPayload["custom:type"] ||
      tokenPayload["cognito:groups"]?.[0] ||
      null; // Não usar fallback ainda

    // Se não encontrou o tipo no Cognito, verificar se é admin pelo email ou CouchDB
    if (!userType) {
      // Verificar se é admin pelo email conhecido
      if (userEmail === "admin@company.com") {
        userType = "admin";
        //console.log('✅ Admin identificado pelo email:', userEmail);
      } else {
        // Tentar verificar no CouchDB se existe documento admin:email
        try {
          const adminDocId = `admin:${userEmail}`;
          try {
            const adminDoc = await getDoc(COUCH_USERS_DB, adminDocId);
            if (
              adminDoc &&
              (adminDoc.type === "admin" || adminDoc.type === "superadmin")
            ) {
              userType = "admin";
              //console.log('✅ Admin identificado no CouchDB:', adminDocId);
            }
          } catch (err) {
            // Documento não existe, não é admin
            //console.log('ℹ️ Documento admin não encontrado no CouchDB:', adminDocId);
          }
        } catch (err) {
          console.warn("⚠️ Erro ao verificar admin no CouchDB:", err);
        }
      }

      // Se ainda não identificou, verificar se é revenda pelo domínio
      if (!userType && userEmail.includes("@")) {
        const domain = userEmail.split("@")[1];
        try {
          const revendaDocId = `revenda:${domain}`;
          try {
            const revendaDoc = await getDoc(COUCH_USERS_DB, revendaDocId);
            if (revendaDoc && revendaDoc.type === "revenda") {
              userType = "revenda";
              //console.log('✅ Revenda identificada no CouchDB:', revendaDocId);
            }
          } catch (err) {
            // Documento não existe
          }
        } catch (err) {
          // Ignora erro
        }
      }

      // Fallback: se não identificou, assume cliente
      if (!userType) {
        userType = "cliente";
        //console.log('ℹ️ Tipo não identificado, assumindo cliente');
      }
    }

    // Extrair doc_id do Cognito (formato: admin:admin@company.com)
    const docId =
      tokenPayload["custom:doc_id"] ||
      (userType === "admin" || userType === "superadmin"
        ? `admin:${userEmail}`
        : null) ||
      (userType === "revenda"
        ? `revenda:${tokenPayload["custom:domain"] || userEmail.split("@")[1]}`
        : null) ||
      (userType === "cliente" ? `user:${userEmail}` : null);

    // Consultar CouchDB para obter status, CNPJ e sub_role
    let userStatus = tokenPayload["custom:status"] || null;
    let userCnpj = tokenPayload["custom:cnpj"] || null;
    let userSubRole = tokenPayload["custom:sub_role"] || null;

    if (docId) {
      try {
        const userDoc = await getDoc(COUCH_USERS_DB, docId);
        if (userDoc) {
          // Tipo real do CouchDB (ex: superadmin) pode diferir do Cognito (ex: admin)
          if (userDoc.type && userDoc.type !== userType) {
            userType = userDoc.type;
          }
          if (userDoc.status) {
            userStatus = userDoc.status;
          }
          // Sub-role para clientes (backward compat: sem sub_role = superusuario)
          if (userType === "cliente") {
            userSubRole = userDoc.sub_role || userSubRole || "superusuario";
            //console.log('✅ Sub-role do cliente:', userSubRole);
          }
          // CNPJ: admin/revenda/cliente têm no documento; Cognito pode não ter custom:cnpj
          if (
            !userCnpj &&
            (userType === "admin" || userType === "superadmin") &&
            userDoc.cnpj_admin
          ) {
            userCnpj = userDoc.cnpj_admin;
            //console.log('✅ CNPJ do admin obtido do CouchDB:', userCnpj);
          } else if (
            !userCnpj &&
            userType === "revenda" &&
            (userDoc.cnpj_revenda || userDoc.cnpj)
          ) {
            userCnpj = userDoc.cnpj_revenda || userDoc.cnpj;
            //console.log('✅ CNPJ da revenda obtido do CouchDB:', userCnpj);
          } else if (
            !userCnpj &&
            userType === "cliente" &&
            (userDoc.cnpj_cliente || userDoc.cnpj)
          ) {
            userCnpj = userDoc.cnpj_cliente || userDoc.cnpj;
            //console.log('✅ CNPJ do cliente obtido do CouchDB:', userCnpj);
          }
        }
      } catch (err) {
        //console.log('ℹ️ Documento não encontrado no CouchDB, usando padrão');
      }
    }

    // Admin/superadmin sempre deve ser "active"
    if (userType === "admin" || userType === "superadmin") {
      userStatus = "active";
    } else if (!userStatus) {
      // Se não encontrou status, usar 'active' como padrão (usuários existentes)
      userStatus = "active";
      //console.log('ℹ️ Status não encontrado, usando padrão: active');
    }

    // Verificação & Termos: buscar do CouchDB
    let emailVerified = true; // default para backward compat
    let termsAccepted = false;
    let termsVersion = null;

    if (docId) {
      try {
        const verifyDoc = await getDoc(COUCH_USERS_DB, docId);
        if (verifyDoc) {
          emailVerified =
            verifyDoc.email_verified !== undefined
              ? verifyDoc.email_verified
              : true; // backward compat
          termsAccepted = verifyDoc.terms_accepted || false;
          termsVersion = verifyDoc.terms_version || null;
        }
      } catch (err) {
        // Ignora erro, usa defaults
      }
    }

    // Determinar ação necessária
    let requiresAction = null;
    if (!emailVerified) {
      requiresAction = "verify_email";
    } else if (!termsAccepted) {
      requiresAction = "accept_terms";
    }

    // Extrair atributos relevantes
    // IMPORTANTE: Garantir que type e status sejam strings, não null/undefined
    const user = {
      email: tokenPayload.email || email,
      name: tokenPayload.name,
      phone_number: tokenPayload.phone_number,
      sub: tokenPayload.sub,
      type: userType || "cliente", // Garantir que sempre tenha um valor
      status: userStatus || "active", // Garantir que sempre tenha um valor
      // CNPJ do doc (CouchDB) ou do Cognito - crítico para filtragem (admin/revenda/cliente)
      cnpj: userCnpj ?? tokenPayload["custom:cnpj"] ?? undefined,
      doc_id: docId, // ✅ ID do documento no CouchDB
      // Sub-role para clientes (superusuario, gerente, comum)
      sub_role:
        userType === "cliente" ? userSubRole || "superusuario" : undefined,
      // Verificação & Termos
      email_verified: emailVerified,
      terms_accepted: termsAccepted,
      terms_version: termsVersion,
      requires_action: requiresAction,
    };

    // Garantir que admin/superadmin sempre tenha status active
    if (user.type === "admin" || user.type === "superadmin") {
      user.status = "active";
    }

    // Log final do objeto user antes de salvar
    console.log("📦 User object final antes de salvar:", {
      email: user.email,
      type: user.type,
      status: user.status,
      doc_id: user.doc_id,
      fullObject: user,
    });

    //console.log('👤 User object criado:', user);
    //console.log('   Type:', userType);
    //console.log('   Doc ID:', docId);
    //console.log('   Status:', user.status);

    // Criar token no formato base64(email:type:cnpj:sub_role) para o FastAPI
    const fastApiToken = btoa(
      `${user.email}:${userType}:${user.cnpj || ""}:${user.sub_role || ""}`,
    );

    //console.log('🔑 Token FastAPI gerado:', fastApiToken);
    //console.log('   Email:', user.email);
    //console.log('   Type:', userType);
    //console.log('   Token decodificado:', atob(fastApiToken));

    // Armazenar as informações de login no Zustand
    // Usar o token FastAPI para comunicação com a API
    //console.log('💾 Salvando no store:', { email: user.email, type: user.type, status: user.status });
    useAuthStore.getState().login(user, fastApiToken);

    // Verificar se foi salvo corretamente
    const savedUser = useAuthStore.getState().user;
    console.log("✅ Usuário salvo no store:", {
      email: savedUser?.email,
      type: savedUser?.type,
      status: savedUser?.status,
      isActive: savedUser?.status === "active",
    });

    return response.data;
  } catch (error) {
    console.error("\n❌ ===== ERRO NA AUTENTICAÇÃO =====");
    console.error("Status:", error.response?.status);
    console.error("Tipo de erro (Cognito):", error.response?.data?.__type);
    console.error("Mensagem de erro:", error.response?.data?.message);
    console.error(
      "Payload completo da resposta:",
      JSON.stringify(error.response?.data, null, 2),
    );
    console.error("Headers da resposta:", error.response?.headers);
    console.error("Mensagem do erro:", error.message);
    console.error("Stack trace:", error.stack);

    // Log adicional para análise
    console.error("\n📋 Resumo do erro:");
    console.error("- Email tentado:", email);
    console.error("- CLIENT_ID usado:", COGNITO_CLIENT_ID);
    console.error("- AuthFlow:", "USER_PASSWORD_AUTH");

    const cognitoType = error.response?.data?.__type;
    const cognitoMessage = error.response?.data?.message;

    // Mensagem amigável para o usuário
    if (cognitoType === "NotAuthorizedException") {
      throw new Error(
        cognitoMessage && cognitoMessage.includes("password")
          ? 'Email ou senha incorretos. Verifique os dados ou use "Esqueci minha senha".'
          : "Não autorizado. Verifique seu email e senha.",
      );
    }
    if (cognitoType === "UserNotFoundException") {
      throw new Error(
        "Usuário não encontrado. Verifique o email ou crie uma conta.",
      );
    }
    if (cognitoType === "UserNotConfirmedException") {
      throw new Error(
        "Conta não confirmada. Verifique seu email e confirme o cadastro.",
      );
    }

    throw new Error(cognitoMessage || cognitoType || error.message);
  }
};

// Serviço para iniciar o fluxo de "Esqueci a Senha"
export const forgotPassword = async (email) => {
  try {
    const payload = {
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
    };

    const response = await api.post("/", payload, {
      headers: {
        "X-Amz-Target": "AWSCognitoIdentityProviderService.ForgotPassword",
      },
    });
    return response.data; // Resposta pode incluir detalhes sobre como proceder
  } catch (error) {
    throw new Error(
      `Erro ao iniciar fluxo de recuperação de senha: ${error.message}`,
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
    const payload = {
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      ConfirmationCode: confirmationCode,
      Password: newPassword,
    };

    const response = await api.post("/", payload, {
      headers: {
        "X-Amz-Target":
          "AWSCognitoIdentityProviderService.ConfirmForgotPassword",
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Erro ao redefinir senha: ${error.message}`);
  }
};

// Serviço para trocar senha com o usuário autenticado
export const changePassword = async (
  accessToken,
  previousPassword,
  proposedPassword,
) => {
  try {
    const response = await api.post(
      "/",
      {
        PreviousPassword: previousPassword,
        ProposedPassword: proposedPassword,
      },
      {
        headers: {
          "X-Amz-Target": "AWSCognitoIdentityProviderService.ChangePassword",
          Authorization: accessToken,
        },
      },
    );
    return response.data;
  } catch (error) {
    throw new Error(`Erro ao trocar senha: ${error.message}`);
  }
};
