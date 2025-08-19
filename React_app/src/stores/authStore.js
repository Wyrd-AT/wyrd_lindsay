import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Definindo a store sem interfaces, já que estamos utilizando JavaScript
export const useAuthStore = create(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      companyId: null,  // Adiciona o companyId ao estado
      login: (user, token) => {
        // Extrai o companyId do email
        //console.log(user)
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
