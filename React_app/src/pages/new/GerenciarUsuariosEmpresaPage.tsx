/// <reference types="vite/client" />
/**
 * Página: Gerenciar Usuários da Empresa (Superusuário only)
 *
 * - Lista usuários do mesmo cnpj_cliente
 * - Permite criar gerentes e comuns
 */

import { useEffect, useState, useCallback } from "react";
import { useAuthStore, selectIsSuperusuario } from "../../stores/new/authStore";
import Sidebar from "../../components/new/sidebar";
import BodyContent from "../../components/new/body";
import Header from "../../components/new/header";
import PermissionGuard from "../../components/new/PermissionGuard";
import { CreateCompanyUserModal } from "../../components/new/CreateCompanyUserModal";
import { fetchCompanyUsers } from "../../api/new/fastapi-admin";
import { matchesSearchTerm } from "../../utils/search";

interface CompanyUser {
  _id: string;
  email: string;
  name: string;
  sub_role: string;
  status: string;
}

export function GerenciarUsuariosEmpresaPage() {
  const isSuperusuario = useAuthStore(selectIsSuperusuario);

  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCompanyUsers();
      setUsers(data.users || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar usuários",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperusuario) {
      loadUsers();
    }
  }, [isSuperusuario, loadUsers]);

  const subRoleLabel = (role: string) => {
    switch (role) {
      case "superusuario":
        return "Superusuário";
      case "gerente":
        return "Gerente";
      case "comum":
        return "Comum";
      default:
        return role;
    }
  };

  const subRoleBadgeClass = (role: string) => {
    switch (role) {
      case "superusuario":
        return "bg-purple-900 text-purple-100";
      case "gerente":
        return "bg-blue-900 text-blue-100";
      case "comum":
        return "bg-gray-700 text-gray-100";
      default:
        return "bg-gray-700 text-gray-100";
    }
  };

  const statusBadgeClass = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-900 text-green-100";
      case "pending":
        return "bg-yellow-900 text-yellow-100";
      case "rejected":
        return "bg-red-900 text-red-100";
      default:
        return "bg-gray-700 text-gray-100";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Ativo";
      case "pending":
        return "Pendente";
      case "rejected":
        return "Rejeitado";
      default:
        return status;
    }
  };

  const filteredUsers = users.filter((user) =>
    matchesSearchTerm(searchTerm, [
      user.name,
      user.email,
      user.sub_role,
      user.status,
    ]),
  );

  return (
    <PermissionGuard
      allowedRoles={["cliente"]}
      allowedSubRoles={["superusuario"]}
      requireActive
    >
      <div className="w-full h-full text-dashboard-text-primary flex bg-dashboard-bg-primary">
        <Sidebar />
        <BodyContent>
          <Header
            page="cliente"
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Pesquisar usuário por nome, email ou perfil..."
          />

          <div className="flex items-center justify-between px-4 mb-8">
            <h1 className="text-3xl font-bold">Usuários da Empresa</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-3 py-1 text-sm bg-dashboard-accent hover:bg-dashboard-accent-hover rounded transition text-black font-bold"
              >
                + Criar Usuário
              </button>
              <button
                onClick={loadUsers}
                disabled={loading}
                className="bg-dashboard-accent p-2 rounded-lg font-bold hover:bg-dashboard-accent-hover transition text-black text-sm px-3 disabled:bg-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed"
              >
                {loading ? "Carregando..." : "Atualizar"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mx-4 mb-6 p-4 bg-red-900 border border-red-700 rounded-lg text-red-100">
              <p className="font-medium">Erro ao carregar dados:</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Stats */}
          <div className="px-4 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {loading ? (
                [0, 1, 2].map((i) => (
                  <div
                    key={`skeleton-${i}`}
                    className="h-24 bg-dashboard-bg-secondary animate-pulse rounded-lg"
                  />
                ))
              ) : (
                <>
                  <div className="bg-dashboard-bg-secondary rounded-lg p-6 border border-dashboard-border hover:border-dashboard-accent transition-colors">
                    <p className="text-sm text-dashboard-text-secondary font-medium">
                      Total
                    </p>
                    <p className="text-4xl font-bold text-dashboard-text-primary mt-2">
                      {users.length}
                    </p>
                  </div>
                  <div className="bg-dashboard-bg-secondary rounded-lg p-6 border border-dashboard-border hover:border-dashboard-accent transition-colors">
                    <p className="text-sm text-dashboard-text-secondary font-medium">
                      Gerentes
                    </p>
                    <p className="text-4xl font-bold text-dashboard-text-primary mt-2">
                      {users.filter((u) => u.sub_role === "gerente").length}
                    </p>
                  </div>
                  <div className="bg-dashboard-bg-secondary rounded-lg p-6 border border-dashboard-border hover:border-dashboard-accent transition-colors">
                    <p className="text-sm text-dashboard-text-secondary font-medium">
                      Comuns
                    </p>
                    <p className="text-4xl font-bold text-dashboard-text-primary mt-2">
                      {users.filter((u) => u.sub_role === "comum").length}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Users List */}
          <div className="px-4 mb-8">
            <div className="bg-dashboard-bg-secondary rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-dashboard-text-primary mb-4">
                Usuários
              </h2>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dashboard-accent" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-dashboard-text-secondary">
                  <p>
                    {users.length === 0
                      ? "Nenhum usuário encontrado"
                      : "Nenhum usuário encontrado para a busca atual"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto scrollbar scrollbar-thin scrollbar-thumb-dashboard-accent scrollbar-track-dashboard-bg-tertiary">
                  {filteredUsers.map((user, idx) => (
                    <div
                      key={user._id ?? user.email ?? `user-${idx}`}
                      className="border border-dashboard-border rounded-lg p-4 hover:bg-dashboard-border transition bg-dashboard-bg-tertiary"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-dashboard-text-primary">
                            {user.name}
                          </h3>
                          <p className="text-sm text-dashboard-text-secondary mt-1">
                            {user.email}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <span
                            className={`text-xs px-2 py-1 rounded font-bold ${subRoleBadgeClass(user.sub_role)}`}
                          >
                            {subRoleLabel(user.sub_role)}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded font-bold ${statusBadgeClass(user.status)}`}
                          >
                            {statusLabel(user.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {showCreateModal && (
            <CreateCompanyUserModal
              closeModal={() => setShowCreateModal(false)}
              onSuccess={() => {
                setShowCreateModal(false);
                loadUsers();
              }}
            />
          )}
        </BodyContent>
      </div>
    </PermissionGuard>
  );
}

export default GerenciarUsuariosEmpresaPage;
