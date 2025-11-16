import api, { COGNITO_CLIENT_ID } from '../new/api';
import { useAuthStore } from '../../stores/old/authStore';

// Serviço para criar um usuário (sign-up)
export const signUp = async (email, password, companyId) => {
  try {
    const response = await api.post('/', {
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        {
          Name: 'custom:company_id',
          Value: companyId,
        },
      ],
    }, {
      headers: {
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp',
      },
    });
    return response.data;
  } catch (error) {
    ////console.log(error);
    throw new Error(`Erro ao registrar usuário: ${error.response.data.message}`);
  }
};

// Serviço para confirmar o e-mail após o cadastro
export const confirmSignUp = async (email, confirmationCode) => {
  try {
    const response = await api.post('/', {
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      ConfirmationCode: confirmationCode,
    }, {
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
    const response = await api.post('/', {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: COGNITO_CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    }, {
      headers: {
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
    });
    const { AccessToken, IdToken } = response.data.AuthenticationResult;

    // Armazena as informações de login no Zustand
    const user = { email };  // Adicione outros dados que quiser armazenar sobre o usuário
    useAuthStore.getState().login(user, AccessToken);

    return response.data;
  } catch (error) {
    throw new Error(`Erro ao autenticar usuário: ${error.message}`);
  }


};

// Serviço para iniciar o fluxo de "Esqueci a Senha"
export const forgotPassword = async (email) => {
  try {
    const response = await api.post('/', {
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
    }, {
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
    const response = await api.post('/', {
      ClientId: COGNITO_CLIENT_ID,
      Username: email,
      ConfirmationCode: confirmationCode,
      Password: newPassword,
    }, {
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
