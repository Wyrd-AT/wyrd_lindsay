import React from "react";
import {
  useAuthStore,
  selectIsActiveUser,
  selectUserRole,
  selectUserStatus,
  selectSubRole,
} from "../../stores/new/authStore";
import type {
  UserRole,
  UserStatus,
  ClienteSubRole,
} from "../../stores/new/authStore";

export interface PermissionGuardProps {
  /** Roles permitidos */
  allowedRoles?: UserRole[];
  /** Statuses permitidos */
  allowedStatuses?: UserStatus[];
  /** Sub-roles de cliente permitidos (superusuario, gerente, comum) */
  allowedSubRoles?: ClienteSubRole[];
  /** Requer que o usuário esteja ativo */
  requireActive?: boolean;
  /** Conteúdo a exibir quando autorizado */
  children: React.ReactNode;
  /** Conteúdo a exibir quando não autorizado (padrão: mensagem genérica) */
  fallback?: React.ReactNode;
  /** Callback quando acesso é negado */
  onDenied?: () => void;
}

/**
 * Componente que protege conteúdo baseado em permissões do usuário.
 *
 * Verifica:
 * - Role do usuário (admin, revenda, cliente)
 * - Status do usuário (active, pending, rejected)
 * - Autenticação
 *
 * @example
 * ```tsx
 * // Apenas admins ativos podem ver
 * <PermissionGuard
 *   allowedRoles={['admin']}
 *   requireActive={true}
 * >
 *   <AdminPanel />
 * </PermissionGuard>
 *
 * // Revendas e clientes ativos
 * <PermissionGuard
 *   allowedRoles={['revenda', 'cliente']}
 *   allowedStatuses={['active']}
 * >
 *   <DashboardContent />
 * </PermissionGuard>
 * ```
 */
export function PermissionGuard({
  allowedRoles,
  allowedStatuses,
  allowedSubRoles,
  requireActive = false,
  children,
  fallback,
  onDenied,
}: PermissionGuardProps): React.ReactElement {
  const authState = useAuthStore();
  const isActiveUser = selectIsActiveUser(authState);
  const userRole = selectUserRole(authState);
  const userStatus = selectUserStatus(authState);
  const subRole = selectSubRole(authState);

  // Verificar se usuário está autenticado
  if (!authState.isAuthenticated || !authState.user) {
    if (onDenied) onDenied();
    return <>{fallback || <UnauthorizedMessage reason="não autenticado" />}</>;
  }

  // Verificar se requer estar ativo
  if (requireActive && !isActiveUser) {
    console.warn("⚠️ PermissionGuard - Acesso negado:", {
      reason: "requireActive=true mas isActiveUser=false",
      userStatus: userStatus,
      userType: userRole,
      userEmail: authState.user?.email,
    });
    if (onDenied) onDenied();
    return (
      <>
        {fallback || (
          <UnauthorizedMessage reason="sua conta ainda não foi aprovada" />
        )}
      </>
    );
  }

  // Verificar roles permitidos
  if (
    allowedRoles &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(userRole as UserRole)
  ) {
    if (onDenied) onDenied();
    return (
      <>
        {fallback || (
          <UnauthorizedMessage
            reason={`você não possui permissão (role: ${userRole})`}
          />
        )}
      </>
    );
  }

  // Verificar statuses permitidos
  if (
    allowedStatuses &&
    allowedStatuses.length > 0 &&
    !allowedStatuses.includes(userStatus as UserStatus)
  ) {
    if (onDenied) onDenied();
    return (
      <>
        {fallback || (
          <UnauthorizedMessage reason={`status inválido (${userStatus})`} />
        )}
      </>
    );
  }

  // Verificar sub-roles de cliente permitidos
  if (
    allowedSubRoles &&
    allowedSubRoles.length > 0 &&
    userRole === "cliente" &&
    !allowedSubRoles.includes((subRole || "superusuario") as ClienteSubRole)
  ) {
    if (onDenied) onDenied();
    return (
      <>
        {fallback || (
          <UnauthorizedMessage reason={`sub-role insuficiente (${subRole})`} />
        )}
      </>
    );
  }

  return <>{children}</>;
}

/**
 * Componente para exibir mensagem de acesso não autorizado
 */
function UnauthorizedMessage({ reason }: { reason: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        <div className="mb-4">
          <svg
            className="mx-auto h-12 w-12 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4v2m0 4v2m0-12l4.243 4.243m-8.486 0L3.757 7m8.486 8.486l4.243-4.243m-8.486 0L3.757 17"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Acesso Negado</h1>
        <p className="text-gray-600 mb-6">
          Desculpe, você não tem permissão para acessar este conteúdo.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Motivo: <span className="font-medium">{reason}</span>
        </p>
        <a
          href="/"
          className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          Voltar à Página Inicial
        </a>
      </div>
    </div>
  );
}

/**
 * Higher-Order Component que protege um componente com PermissionGuard
 */
export function withPermissionGuard<P extends object>(
  Component: React.ComponentType<P>,
  options: Omit<PermissionGuardProps, "children">,
) {
  return function ProtectedComponent(props: P) {
    return (
      <PermissionGuard {...options}>
        <Component {...props} />
      </PermissionGuard>
    );
  };
}

/**
 * Hook para verificar permissões no componente
 */
export function usePermissionCheck(
  allowedRoles?: UserRole[],
  allowedStatuses?: UserStatus[],
  requireActive?: boolean,
  allowedSubRoles?: ClienteSubRole[],
): boolean {
  const authState = useAuthStore();
  const isActiveUser = selectIsActiveUser(authState);
  const userRole = selectUserRole(authState);
  const userStatus = selectUserStatus(authState);
  const subRole = selectSubRole(authState);

  if (!authState.isAuthenticated) return false;

  if (requireActive && !isActiveUser) return false;

  if (allowedRoles && !allowedRoles.includes(userRole as UserRole)) {
    return false;
  }

  if (allowedStatuses && !allowedStatuses.includes(userStatus as UserStatus)) {
    return false;
  }

  if (
    allowedSubRoles &&
    allowedSubRoles.length > 0 &&
    userRole === "cliente" &&
    !allowedSubRoles.includes((subRole || "superusuario") as ClienteSubRole)
  ) {
    return false;
  }

  return true;
}

export default PermissionGuard;
