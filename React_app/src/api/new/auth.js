import { useAuthStore } from '../../stores/new/authStore.ts';
import api, { COGNITO_CLIENT_ID } from './api';
import { getDoc } from './couch';

// IMPORTANTE: CLIENT_SECRET deve estar em .env como VITE_COGNITO_CLIENT_SECRET
// AVISO: CLIENT_SECRET nunca deve ser exposto em produção no frontend!
// Para aplicações públicas, use um cliente Cognito SEM secret.
const COGNITO_CLIENT_SECRET = import.meta.env.VITE_COGNITO_CLIENT_SECRET || '1jeh2l3f1uf4pjaqcf77i7a2rccucjlg7cnc3lu89n9hhc25qcv6';

// Função para calcular SECRET_HASH (HMAC-SHA256)
const calculateSecretHash = async (username) => {
  console.log('\n🔑 Iniciando cálculo de SECRET_HASH...');

  if (!COGNITO_CLIENT_SECRET) {
    console.warn('⚠️ COGNITO_CLIENT_SECRET não definido - SECRET_HASH não será calculado');
    return '';
  }

  console.log('✅ CLIENT_SECRET está disponível');
  console.log('📝 Username para hash:', username);
  console.log('📝 CLIENT_ID para hash:', COGNITO_CLIENT_ID);

  const message = username + COGNITO_CLIENT_ID;
  console.log('📝 Mensagem completa para hash:', message);

  try {
    // Converter strings para Uint8Array
    const encoder = new TextEncoder();
    const messageBuffer = encoder.encode(message);
    const secretBuffer = encoder.encode(COGNITO_CLIENT_SECRET);

    console.log('✅ Buffers criados com sucesso');

    // Calcular HMAC-SHA256
    const key = await crypto.subtle.importKey(
      'raw',
      secretBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    console.log('✅ Chave HMAC importada');

    const signature = await crypto.subtle.sign('HMAC', key, messageBuffer);

    console.log('✅ HMAC-SHA256 calculado');

    // Converter para Base64
    const hashArray = Array.from(new Uint8Array(signature));
    const hashString = btoa(String.fromCharCode.apply(null, hashArray));

    console.log('✅ Convertido para Base64');
    console.log('🔐 SECRET_HASH final:', hashString.substring(0, 30) + '...');

    return hashString;
  } catch (err) {
    console.error('❌ Erro ao calcular SECRET_HASH:', err);
    throw err;
  }
};

// Função auxiliar para decodificar JWT
const decodeToken = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Erro ao decodificar token:', error);
    return {};
  }
};

// Serviço para criar um usuário (sign-up)
export const signUp = async (email, password, companyId, customAttributes = {}) => {
  try {
    const secretHash = await calculateSecretHash(email);

    // Atributos padrão do Cognito (sempre disponíveis)
    const userAttributes = [
      {
        Name: 'email',
        Value: email,
      },
    ];

    // Adicionar atributos padrão (não customizados)
    if (customAttributes.name) {
      userAttributes.push({
        Name: 'name',
        Value: customAttributes.name,
      });
    }
    if (customAttributes.phone_number) {
      userAttributes.push({
        Name: 'phone_number',
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
    if (companyId) {
      userAttributes.push({
        Name: 'custom:company_id',
        Value: companyId,
      });
    }
    */

    // Preparar payload - só incluir SecretHash se não estiver vazio
    const payload = {
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: userAttributes,
    };

    // Só adicionar SecretHash se o client tiver secret configurado
    if (secretHash && secretHash.length > 0) {
      payload.SecretHash = secretHash;
    }

    const response = await api.post('/', payload, {
      headers: {
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp',
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Erro ao registrar usuário: ${error.response.data.message}`);
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
 * @returns {Promise<Object>} Resposta do backend
 */
export const registerRevenda = async (email, password, name, domain, cnpj) => {
  try {
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        name,
        user_type: 'revenda',
        domain,
        cnpj,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || `Erro ao registrar revenda: ${response.status}`);
    }

    console.log('✅ Revenda registrada com sucesso:');
    console.log('   Email:', email);
    console.log('   Domínio:', domain);
    console.log('   CNPJ:', cnpj);
    console.log('   Status:', data.message);

    return data;

  } catch (error) {
    console.error('❌ Erro ao registrar revenda:', error);
    throw new Error(error.message || 'Falha ao registrar revenda. Por favor, tente novamente.');
  }
};

// Serviço para confirmar o e-mail após o cadastro
export const confirmSignUp = async (email, confirmationCode) => {
  try {
    const secretHash = await calculateSecretHash(email);

    // Preparar payload - só incluir SecretHash se não estiver vazio
    const payload = {
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      ConfirmationCode: confirmationCode,
    };

    // Só adicionar SecretHash se o client tiver secret configurado
    if (secretHash && secretHash.length > 0) {
      payload.SecretHash = secretHash;
    }

    const response = await api.post('/', payload, {
      headers: {
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.ConfirmSignUp',
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Erro ao confirmar e-mail: ${error.message}`);
  }
};

// Serviço para autenticar o usuário (sign-in)
export const signIn = async (email, password) => {
  try {
    console.log('\n🔐 ===== INICIANDO AUTENTICAÇÃO =====');
    console.log('Email:', email);
    console.log('Password length:', password.length);
    console.log('CLIENT_ID:', COGNITO_CLIENT_ID);
    console.log('CLIENT_SECRET configurado:', !!COGNITO_CLIENT_SECRET);

    const secretHash = await calculateSecretHash(email);
    console.log('\n📝 SECRET_HASH calculado:', secretHash ? secretHash.substring(0, 20) + '...' : 'NÃO CALCULADO');

    const authParameters = {
      USERNAME: email,
      PASSWORD: password,
    };

    // Adicionar SECRET_HASH se o client tiver secret configurado
    if (secretHash && secretHash.length > 0) {
      authParameters.SECRET_HASH = secretHash;
      console.log('✅ SECRET_HASH adicionado aos parâmetros');
    } else {
      console.log('⚠️ SECRET_HASH NÃO foi adicionado (vazio ou não calculado)');
    }

    const payload = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: authParameters,
    };

    console.log('\n📦 Payload enviado para Cognito:');
    console.log(JSON.stringify({
      AuthFlow: payload.AuthFlow,
      ClientId: payload.ClientId,
      AuthParameters: {
        USERNAME: authParameters.USERNAME,
        PASSWORD: '***REDACTED***',
        SECRET_HASH: authParameters.SECRET_HASH ? authParameters.SECRET_HASH.substring(0, 20) + '...' : 'undefined'
      }
    }, null, 2));

    const response = await api.post('/', payload, {
      headers: {
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
    });
    console.log('✅ Resposta completa do Cognito:');
    console.log('response.data:', response.data);
    console.log('AuthenticationResult:', response.data.AuthenticationResult);

    const { AccessToken, IdToken } = response.data.AuthenticationResult;

    console.log('AccessToken:', AccessToken);
    console.log('IdToken:', IdToken);

    // Decodificar o IdToken para extrair atributos do usuário
    const tokenPayload = decodeToken(IdToken);

    console.log('🔐 Token Payload (atributos do usuário):');
    console.log('tokenPayload:', tokenPayload);

    const userEmail = tokenPayload.email || email;
    
    // Extrair tipo do usuário (custom:type do Cognito ou inferir)
    let userType = tokenPayload['custom:type'] || 
                   tokenPayload['cognito:groups']?.[0] || 
                   null; // Não usar fallback ainda
    
    // Se não encontrou o tipo no Cognito, verificar se é admin pelo email ou CouchDB
    if (!userType) {
      // Verificar se é admin pelo email conhecido
      if (userEmail === 'admin@company.com') {
        userType = 'admin';
        console.log('✅ Admin identificado pelo email:', userEmail);
      } else {
        // Tentar verificar no CouchDB se existe documento admin:email
        try {
          const adminDocId = `admin:${userEmail}`;
          try {
            const adminDoc = await getDoc('lindsay-data', adminDocId);
            if (adminDoc && adminDoc.type === 'admin') {
              userType = 'admin';
              console.log('✅ Admin identificado no CouchDB:', adminDocId);
            }
          } catch (err) {
            // Documento não existe, não é admin
            console.log('ℹ️ Documento admin não encontrado no CouchDB:', adminDocId);
          }
        } catch (err) {
          console.warn('⚠️ Erro ao verificar admin no CouchDB:', err);
        }
      }
      
      // Se ainda não identificou, verificar se é revenda pelo domínio
      if (!userType && userEmail.includes('@')) {
        const domain = userEmail.split('@')[1];
        try {
          const revendaDocId = `revenda:${domain}`;
          try {
            const revendaDoc = await getDoc('lindsay-data', revendaDocId);
            if (revendaDoc && revendaDoc.type === 'revenda') {
              userType = 'revenda';
              console.log('✅ Revenda identificada no CouchDB:', revendaDocId);
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
        userType = 'cliente';
        console.log('ℹ️ Tipo não identificado, assumindo cliente');
      }
    }
    
    // Extrair doc_id do Cognito (formato: admin:admin@company.com)
    const docId = tokenPayload['custom:doc_id'] || 
                  (userType === 'admin' ? `admin:${userEmail}` : null) ||
                  (userType === 'revenda' ? `revenda:${tokenPayload['custom:domain'] || userEmail.split('@')[1]}` : null) ||
                  (userType === 'cliente' ? `user:${userEmail}` : null);
    
    // Consultar CouchDB para obter status real do usuário
    let userStatus = tokenPayload['custom:status'] || null;
    
    // Se não veio do Cognito, consultar CouchDB
    if (!userStatus && docId) {
      try {
        const userDoc = await getDoc('lindsay-data', docId);
        if (userDoc && userDoc.status) {
          userStatus = userDoc.status;
          console.log('✅ Status obtido do CouchDB:', userStatus);
        }
      } catch (err) {
        console.log('ℹ️ Documento não encontrado no CouchDB, usando padrão');
      }
    }
    
    // Admin sempre deve ser "active"
    if (userType === 'admin') {
      userStatus = 'active'; // Admin sempre ativo
    } else if (!userStatus) {
      // Se não encontrou status, usar 'active' como padrão (usuários existentes)
      // ou 'pending' para novos usuários (mas como não temos como saber, usamos 'active')
      userStatus = 'active';
      console.log('ℹ️ Status não encontrado, usando padrão: active');
    }
    
    // Extrair atributos relevantes
    // IMPORTANTE: Garantir que type e status sejam strings, não null/undefined
    const user = {
      email: tokenPayload.email || email,
      name: tokenPayload.name,
      phone_number: tokenPayload.phone_number,
      sub: tokenPayload.sub,
      type: userType || 'cliente', // Garantir que sempre tenha um valor
      status: userStatus || 'active', // Garantir que sempre tenha um valor
      // Atributos customizados do Cognito (apenas os úteis)
      cnpj: tokenPayload['custom:cnpj'], // ✅ CRÍTICO - para filtragem por admin
      doc_id: docId, // ✅ ID do documento no CouchDB
    };
    
    // Garantir que admin sempre tenha status active
    if (user.type === 'admin') {
      user.status = 'active';
    }
    
    // Log final do objeto user antes de salvar
    console.log('📦 User object final antes de salvar:', {
      email: user.email,
      type: user.type,
      status: user.status,
      doc_id: user.doc_id,
      fullObject: user
    });

    console.log('👤 User object criado:', user);
    console.log('   Type:', userType);
    console.log('   Doc ID:', docId);
    console.log('   Status:', user.status);

    // Criar token no formato base64(email:type:cnpj) para o FastAPI
    // CNPJ é incluído para permitir filtragem por admin no backend
    const fastApiToken = btoa(`${user.email}:${userType}:${user.cnpj || ''}`);
    
    console.log('🔑 Token FastAPI gerado:', fastApiToken);
    console.log('   Email:', user.email);
    console.log('   Type:', userType);
    console.log('   Token decodificado:', atob(fastApiToken));

    // Armazenar as informações de login no Zustand
    // Usar o token FastAPI para comunicação com a API
    console.log('💾 Salvando no store:', { email: user.email, type: user.type, status: user.status });
    useAuthStore.getState().login(user, fastApiToken);
    
    // Verificar se foi salvo corretamente
    const savedUser = useAuthStore.getState().user;
    console.log('✅ Usuário salvo no store:', { 
      email: savedUser?.email, 
      type: savedUser?.type, 
      status: savedUser?.status,
      isActive: savedUser?.status === 'active'
    });

    return response.data;
  } catch (error) {
    console.error('\n❌ ===== ERRO NA AUTENTICAÇÃO =====');
    console.error('Status:', error.response?.status);
    console.error('Tipo de erro (Cognito):', error.response?.data?.__type);
    console.error('Mensagem de erro:', error.response?.data?.message);
    console.error('Payload completo da resposta:', JSON.stringify(error.response?.data, null, 2));
    console.error('Headers da resposta:', error.response?.headers);
    console.error('Mensagem do erro:', error.message);
    console.error('Stack trace:', error.stack);

    // Log adicional para análise
    console.error('\n📋 Resumo do erro:');
    console.error('- Email tentado:', email);
    console.error('- CLIENT_ID usado:', COGNITO_CLIENT_ID);
    console.error('- CLIENT_SECRET configurado:', !!COGNITO_CLIENT_SECRET);
    console.error('- AuthFlow:', 'USER_PASSWORD_AUTH');

    const errorMessage = error.response?.data?.__type || error.response?.data?.message || error.message;
    throw new Error(`Erro ao autenticar usuário: ${errorMessage}`);
  }
};

// Serviço para iniciar o fluxo de "Esqueci a Senha"
export const forgotPassword = async (email) => {
  try {
    const secretHash = await calculateSecretHash(email);

    const payload = {
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
    };

    // Adicionar SecretHash se o client tiver secret configurado
    if (secretHash && secretHash.length > 0) {
      payload.SecretHash = secretHash;
    }

    const response = await api.post('/', payload, {
      headers: {
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.ForgotPassword',
      },
    });
    return response.data; // Resposta pode incluir detalhes sobre como proceder
  } catch (error) {
    throw new Error(`Erro ao iniciar fluxo de recuperação de senha: ${error.message}`);
  }
};

// Serviço para confirmar a nova senha no fluxo de "Esqueci a Senha"
export const confirmForgotPassword = async (email, confirmationCode, newPassword) => {
  try {
    const secretHash = await calculateSecretHash(email);

    const payload = {
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      ConfirmationCode: confirmationCode,
      Password: newPassword,
    };

    // Adicionar SecretHash se o client tiver secret configurado
    if (secretHash && secretHash.length > 0) {
      payload.SecretHash = secretHash;
    }

    const response = await api.post('/', payload, {
      headers: {
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.ConfirmForgotPassword',
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Erro ao redefinir senha: ${error.message}`);
  }
};

// Serviço para trocar senha com o usuário autenticado
export const changePassword = async (accessToken, previousPassword, proposedPassword) => {
  try {
    const response = await api.post('/', {
      PreviousPassword: previousPassword,
      ProposedPassword: proposedPassword,
    }, {
      headers: {
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.ChangePassword',
        Authorization: accessToken,
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Erro ao trocar senha: ${error.message}`);
  }
};
