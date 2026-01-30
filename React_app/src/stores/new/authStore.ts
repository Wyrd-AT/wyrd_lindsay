// stores/authStore.ts
import { create } from 'zustand';
import { persist,createJSONStorage } from 'zustand/middleware';

export interface User {
  email: string;
  username?: string;
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
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      companyId: null,

      login: (user: User, token: string) => {
        // Extrai o companyId do email
        const domainAndTld = user.email.split('@')[1];
        const companyId = domainAndTld.split('.')[0];

        // Atualiza o estado com user, token e companyId
        set({ isAuthenticated: true, user, token, companyId });
      },

      logout: () => {
        // Limpa o estado e a persistência ao fazer logout
        set({ isAuthenticated: false, user: null, token: null, companyId: null });
      },
    }),
     {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage), // Armazena na sessão
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token,
        companyId: state.companyId,  // Persiste o companyId
      }),
    }
  )
);

// Selectors para facilitar o acesso
export const selectIsAuthenticated = (state: AuthState) => state.isAuthenticated;
export const selectUser = (state: AuthState) => state.user;
export const selectToken = (state: AuthState) => state.token;
export const selectCompanyId = (state: AuthState) => state.companyId;
