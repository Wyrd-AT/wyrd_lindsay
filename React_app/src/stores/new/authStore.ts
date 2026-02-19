// stores/authStore.ts
import { create } from 'zustand';
import { persist,createJSONStorage } from 'zustand/middleware';

export type UserRole = 'admin' | 'revenda' | 'cliente';
export type UserStatus = 'active' | 'pending' | 'rejected';

export interface User {
  email: string;
  username?: string;
  name?: string;
  phone_number?: string;
  sub?: string;
  cnpj?: string; // ✅ CRÍTICO - para filtragem por admin
  type?: UserRole;
  status?: UserStatus;
  doc_id?: string; // ✅ ID do documento no CouchDB
  [key: string]: any;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  companyId: string | null;
  equipamentos?: string[];

  // Actions
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      companyId: null,

      login: (user: User, token: string) => {
        // Log para debug
        console.log('🔐 AuthStore.login chamado:', {
          email: user.email,
          type: user.type,
          status: user.status,
          userObject: user
        });

        // Extrai o companyId do email
        const domainAndTld = user.email.split('@')[1];
        const companyId = domainAndTld.split('.')[0];

        // Garantir que o objeto user tenha todas as propriedades
        const completeUser: User = {
          ...user,
          type: user.type || 'cliente',
          status: user.status || 'active',
        };

        // Atualiza o estado com user, token e companyId
        set({ isAuthenticated: true, user: completeUser, token, companyId });
        
        // Verificar se foi salvo
        const state = useAuthStore.getState();
        console.log('✅ AuthStore.login - Estado após salvar:', {
          isAuthenticated: state.isAuthenticated,
          userType: state.user?.type,
          userStatus: state.user?.status,
          userEmail: state.user?.email
        });
      },

      logout: () => {
        // Limpa o estado e a persistência ao fazer logout
        set({ isAuthenticated: false, user: null, token: null, companyId: null });
      },

      updateUser: (updatedFields: Partial<User>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updatedFields } : null,
        }));
      },
    }),
     {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage), // Armazena na sessão
      partialize: (state) => {
        // Log para debug da serialização
        console.log('💾 AuthStore - Serializando estado:', {
          isAuthenticated: state.isAuthenticated,
          userType: state.user?.type,
          userStatus: state.user?.status,
          userEmail: state.user?.email,
          fullUser: state.user
        });
        return {
          isAuthenticated: state.isAuthenticated,
          user: state.user, // Inclui todas as propriedades do user
          token: state.token,
          companyId: state.companyId,
        };
      },
      onRehydrateStorage: () => (state) => {
        // Log quando o estado é restaurado
        console.log('🔄 AuthStore - Estado restaurado:', {
          isAuthenticated: state?.isAuthenticated,
          userType: state?.user?.type,
          userStatus: state?.user?.status,
          userEmail: state?.user?.email,
          fullUser: state?.user
        });
        
        // Se o estado foi restaurado mas não tem type/status, limpar (estado antigo)
        if (state?.isAuthenticated && state?.user && (!state.user.type || !state.user.status)) {
          console.warn('⚠️ Estado antigo detectado sem type/status, limpando estado...');
          
          // Limpar também do sessionStorage
          try {
            sessionStorage.removeItem('auth-storage');
            console.log('✅ Estado antigo removido do sessionStorage');
          } catch (e) {
            console.error('❌ Erro ao limpar sessionStorage:', e);
          }
          
          // Limpar o estado usando setState (executa após a restauração)
          setTimeout(() => {
            useAuthStore.setState({
              isAuthenticated: false,
              user: null,
              token: null,
              companyId: null,
            });
            console.log('✅ Estado limpo após detecção de estado inválido');
          }, 0);
        }
      },
    }
  )
);

// Selectors para facilitar o acesso
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectUser = (state: AuthState) => state.user;
export const selectToken = (state: AuthState) => state.token;
export const selectCompanyId = (state: AuthState) => state.companyId;

// ============================================================================
// Selectors para Sistema Multi-Nível (Admin > Revenda > Cliente)
// ============================================================================

// Verificar role do usuário
export const selectUserRole = (state: AuthState) => state.user?.type || null;
export const selectUserStatus = (state: AuthState) => state.user?.status || null;

// Verificar role específico
export const selectIsAdmin = (state: AuthState) => state.user?.type === 'admin';
export const selectIsRevenda = (state: AuthState) => state.user?.type === 'revenda';
export const selectIsCliente = (state: AuthState) => state.user?.type === 'cliente';

// Verificar status do usuário
export const selectIsActive = (state: AuthState) => state.user?.status === 'active';
export const selectIsPending = (state: AuthState) => state.user?.status === 'pending';
export const selectIsRejected = (state: AuthState) => state.user?.status === 'rejected';

// Verificar se usuário está ativo (necessário para maioria das operações)
export const selectIsActiveUser = (state: AuthState) => {
  // Admin sempre é considerado ativo, mesmo se status não estiver definido
  if (state.isAuthenticated && state.user?.type === 'admin') {
    return true;
  }
  return state.isAuthenticated && state.user?.status === 'active';
};

// Verificar permissões de visualização
export const selectCanViewRevendas = (state: AuthState) => {
  // Apenas admins podem ver todas as revendas
  return selectIsActiveUser(state) && selectIsAdmin(state);
};

export const selectCanManageClientes = (state: AuthState) => {
  // Revendas ativas podem gerenciar seus clientes
  return selectIsActiveUser(state) && selectIsRevenda(state);
};

export const selectCanViewPivos = (state: AuthState) => {
  // Clientes e Revendas podem ver pivôs
  return selectIsActiveUser(state) && (selectIsCliente(state) || selectIsRevenda(state) || selectIsAdmin(state));
};

// Verificar permissões de aprovação
export const selectCanApproveRevendas = (state: AuthState) => {
  // Apenas admins ativos podem aprovar revendas
  return selectIsActiveUser(state) && selectIsAdmin(state);
};

export const selectCanApproveClientes = (state: AuthState) => {
  // Apenas revendas ativas podem aprovar clientes
  return selectIsActiveUser(state) && selectIsRevenda(state);
};

// Helper para verificar se o usuário pode ver um recurso específico
export const selectCanViewResource = (state: AuthState, resourceOwnerId?: string) => {
  if (!selectIsActiveUser(state)) return false;

  // Admin vê tudo
  if (selectIsAdmin(state)) return true;

  // Revenda vê seus clientes
  if (selectIsRevenda(state) && state.user?.doc_id === resourceOwnerId) return true;

  // Cliente vê apenas a si mesmo
  if (selectIsCliente(state) && state.user?.email === resourceOwnerId) return true;

  return false;
};
