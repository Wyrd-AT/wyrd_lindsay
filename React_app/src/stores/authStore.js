import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Definindo a store sem interfaces, já que estamos utilizando JavaScript
export const useAuthStore = create(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      login: (user, token) => {
        set({ isAuthenticated: true, user, token });
      },
      logout: () => {
        ////console.log("logout");
        set({ isAuthenticated: false, user: null, token: null });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage), // Armazena na sessão
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        token: state.token,
      }),
    }
  )
);
