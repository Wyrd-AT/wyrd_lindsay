// stores/authStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type UserRole = "superadmin" | "admin" | "revenda" | "cliente";
export type UserStatus = "active" | "pending" | "rejected";
export type ClienteSubRole = "superusuario" | "gerente" | "comum";

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
  sub_role?: ClienteSubRole; // Sub-role para clientes
  // Verificação & Termos
  email_verified?: boolean;
  terms_accepted?: boolean;
  terms_version?: string;
  requires_action?: "verify_email" | "accept_terms" | null;
  [key: string]: any;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  cnpjCliente: string | null;
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
      cnpjCliente: null,

      login: (user: User, token: string) => {
        // Log para debug
        console.log("🔐 AuthStore.login chamado:", {
          email: user.email,
          type: user.type,
          status: user.status,
          userObject: user,
        });

        // cnpjCliente = CNPJ do usuário (vem do custom:cnpj do Cognito)
        const cnpjCliente = user.cnpj || null;

        // Garantir que o objeto user tenha todas as propriedades
        const completeUser: User = {
          ...user,
          type: user.type || "cliente",
          status: user.status || "active",
        };

        // Atualiza o estado com user, token e cnpjCliente
        set({ isAuthenticated: true, user: completeUser, token, cnpjCliente });

        // Verificar se foi salvo
        const state = useAuthStore.getState();
        console.log("✅ AuthStore.login - Estado após salvar:", {
          isAuthenticated: state.isAuthenticated,
          userType: state.user?.type,
          userStatus: state.user?.status,
          userEmail: state.user?.email,
        });
      },

      logout: () => {
        // Limpa o estado e a persistência ao fazer logout
        set({
          isAuthenticated: false,
          user: null,
          token: null,
          cnpjCliente: null,
        });
      },

      updateUser: (updatedFields: Partial<User>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...updatedFields } : null,
        }));
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => sessionStorage), // Armazena na sessão
      partialize: (state) => {
        // Log para debug da serialização
        console.log("💾 AuthStore - Serializando estado:", {
          isAuthenticated: state.isAuthenticated,
          userType: state.user?.type,
          userStatus: state.user?.status,
          userEmail: state.user?.email,
          fullUser: state.user,
        });
        return {
          isAuthenticated: state.isAuthenticated,
          user: state.user, // Inclui todas as propriedades do user
          token: state.token,
          cnpjCliente: state.cnpjCliente,
        };
      },
      onRehydrateStorage: () => (state) => {
        // Log quando o estado é restaurado
        console.log("🔄 AuthStore - Estado restaurado:", {
          isAuthenticated: state?.isAuthenticated,
          userType: state?.user?.type,
          userStatus: state?.user?.status,
          userEmail: state?.user?.email,
          fullUser: state?.user,
        });

        // Se o estado foi restaurado mas não tem type/status, limpar (estado antigo)
        if (
          state?.isAuthenticated &&
          state?.user &&
          (!state.user.type || !state.user.status)
        ) {
          console.warn(
            "⚠️ Estado antigo detectado sem type/status, limpando estado...",
          );

          // Limpar também do sessionStorage
          try {
            sessionStorage.removeItem("auth-storage");
            console.log("✅ Estado antigo removido do sessionStorage");
          } catch (e) {
            console.error("❌ Erro ao limpar sessionStorage:", e);
          }

          // Limpar o estado usando setState (executa após a restauração)
          setTimeout(() => {
            useAuthStore.setState({
              isAuthenticated: false,
              user: null,
              token: null,
              cnpjCliente: null,
            });
            console.log("✅ Estado limpo após detecção de estado inválido");
          }, 0);
        }
      },
    },
  ),
);

// Selectors para facilitar o acesso
export const selectIsAuthenticated = (state: AuthState) =>
  state.isAuthenticated;
export const selectUser = (state: AuthState) => state.user;
export const selectToken = (state: AuthState) => state.token;
export const selectCnpjCliente = (state: AuthState) => state.cnpjCliente;

// ============================================================================
// Selectors para Sistema Multi-Nível (Admin > Revenda > Cliente)
// ============================================================================

// Verificar role do usuário
export const selectUserRole = (state: AuthState) => state.user?.type || null;
export const selectUserStatus = (state: AuthState) =>
  state.user?.status || null;

// Verificar role específico
export const selectIsSuperAdmin = (state: AuthState) =>
  state.user?.type === "superadmin";
export const selectIsAdmin = (state: AuthState) =>
  state.user?.type === "admin" || state.user?.type === "superadmin";
export const selectIsAdminOnly = (state: AuthState) =>
  state.user?.type === "admin";
export const selectIsRevenda = (state: AuthState) =>
  state.user?.type === "revenda";
export const selectIsCliente = (state: AuthState) =>
  state.user?.type === "cliente";

// Verificar status do usuário
export const selectIsActive = (state: AuthState) =>
  state.user?.status === "active";
export const selectIsPending = (state: AuthState) =>
  state.user?.status === "pending";
export const selectIsRejected = (state: AuthState) =>
  state.user?.status === "rejected";

// Verificar se usuário está ativo (necessário para maioria das operações)
export const selectIsActiveUser = (state: AuthState) => {
  // Admin e superadmin sempre são considerados ativos
  if (
    state.isAuthenticated &&
    (state.user?.type === "admin" || state.user?.type === "superadmin")
  ) {
    return true;
  }
  return state.isAuthenticated && state.user?.status === "active";
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
  return (
    selectIsActiveUser(state) &&
    (selectIsCliente(state) || selectIsRevenda(state) || selectIsAdmin(state))
  );
};

// ============================================================================
// Selectors para Cliente Sub-Roles (Superusuário > Gerente > Comum)
// ============================================================================

export const selectSubRole = (state: AuthState): ClienteSubRole | null =>
  state.user?.type === "cliente"
    ? (state.user?.sub_role as ClienteSubRole) || "superusuario"
    : null;

export const selectIsSuperusuario = (state: AuthState) =>
  state.user?.type === "cliente" &&
  (state.user?.sub_role === "superusuario" || !state.user?.sub_role);

export const selectIsGerente = (state: AuthState) =>
  state.user?.type === "cliente" && state.user?.sub_role === "gerente";

export const selectIsComum = (state: AuthState) =>
  state.user?.type === "cliente" && state.user?.sub_role === "comum";

// Pode resolver alertas: superusuario, gerente, admin, revenda
export const selectCanResolveAlerts = (state: AuthState) => {
  if (!selectIsActiveUser(state)) return false;
  if (selectIsAdmin(state) || selectIsRevenda(state)) return true;
  if (selectIsCliente(state)) {
    return selectIsSuperusuario(state) || selectIsGerente(state);
  }
  return false;
};

// Pode exportar relatórios: superusuario, admin, revenda
export const selectCanExportReports = (state: AuthState): boolean => {
  if (!selectIsActiveUser(state)) return false;
  if (selectIsAdmin(state) || selectIsRevenda(state)) return true;
  if (selectIsCliente(state)) {
    return selectIsSuperusuario(state); // Correção: removido o || selectIsGerente(state)
  }
  return false;
};

// Pode gerenciar usuários da empresa: apenas superusuário
export const selectCanManageCompanyUsers = (state: AuthState) =>
  selectIsActiveUser(state) && selectIsSuperusuario(state);

// Helper para verificar se o usuário pode ver um recurso específico
// ============================================================================
// Selectors para Verificação & Termos
// ============================================================================

export const selectNeedsVerification = (state: AuthState) =>
  state.isAuthenticated && state.user?.email_verified === false;

export const selectNeedsTerms = (state: AuthState) =>
  state.isAuthenticated && state.user?.terms_accepted === false;

export const selectRequiresAction = (state: AuthState) =>
  state.user?.requires_action || null;

export const selectCanViewResource = (
  state: AuthState,
  resourceOwnerId?: string,
) => {
  if (!selectIsActiveUser(state)) return false;

  // Admin vê tudo
  if (selectIsAdmin(state)) return true;

  // Revenda vê seus clientes
  if (selectIsRevenda(state) && state.user?.doc_id === resourceOwnerId)
    return true;

  // Cliente vê apenas a si mesmo
  if (selectIsCliente(state) && state.user?.email === resourceOwnerId)
    return true;

  return false;
};
