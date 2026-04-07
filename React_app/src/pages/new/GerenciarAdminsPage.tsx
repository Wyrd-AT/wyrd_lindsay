/**
 * Pagina Dedicada: Gerenciar Admins
 *
 * Exibe:
 * - Lista de administradores
 * - Criar novo admin
 */

import React, { useEffect, useState } from "react";
import { useAuthStore, selectIsActiveUser } from "../../stores/new/authStore";
import Sidebar from "../../components/new/sidebar";
import BodyContent from "../../components/new/body";
import Header from "../../components/new/header";
import PermissionGuard from "../../components/new/PermissionGuard";
import { CreateAdminModal } from "../../components/new/CreateAdminModal";
import EditEntityModal from "../../components/new/EditEntityModal";
import {
  fetchAdmins,
  updateAdmin,
  deleteAdmin,
} from "../../api/new/fastapi-admin";
import { matchesSearchTerm } from "../../utils/search";

export function GerenciarAdminsPage() {
  const authState = useAuthStore();
  const isActiveUser = selectIsActiveUser(authState);
  const isSuperadmin = authState.user?.type === "superadmin";

  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<any | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const loadAdmins = async () => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await fetchAdmins();
      setAdmins(data.admins || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar admins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isActiveUser) {
      loadAdmins();
    }
  }, [isActiveUser]);

  const filteredAdmins = admins.filter((admin: any) =>
    matchesSearchTerm(searchTerm, [
      admin.name,
      admin.email,
      admin.cnpj_admin,
      admin.type,
      admin.status,
    ]),
  );

  const handleEditAdmin = async (admin: any) => {
    setEditingAdmin(admin);
  };

  const handleSaveAdmin = async (payload: Record<string, any>) => {
    if (!editingAdmin?._id) return;
    setSavingEdit(true);
    try {
      await updateAdmin(editingAdmin._id, payload);
      setEditingAdmin(null);
      await loadAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar admin");
      throw err;
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteAdmin = async (admin: any) => {
    if (!window.confirm(`Deseja deletar ${admin.name || admin.email}?`)) return;
    try {
      await deleteAdmin(admin._id);
      await loadAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao deletar admin");
    }
  };

  return (
    <PermissionGuard allowedRoles={["admin", "superadmin"]} requireActive>
      <div className="w-full h-full text-dashboard-text-primary flex bg-dashboard-bg-primary">
        <Sidebar />
        <BodyContent>
          <Header
            page="admin"
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Pesquisar admin por nome, email ou CNPJ..."
          />

          <div className="flex items-center justify-between px-4 mb-8">
            <h1 className="text-3xl font-bold">Administradores</h1>
            <button
              onClick={loadAdmins}
              disabled={loading}
              className="bg-dashboard-accent p-2 rounded-lg font-bold hover:bg-dashboard-accent-hover transition disabled:bg-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? "Carregando..." : "Atualizar"}
            </button>
          </div>

          {error && (
            <div className="mx-4 mb-6 p-4 bg-red-900 border border-red-700 rounded-lg text-red-100">
              <p className="font-medium">Erro ao carregar dados:</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Stats */}
          <div className="px-4 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loading ? (
                <div className="bg-dashboard-bg-secondary rounded-lg p-6 border border-dashboard-border">
                  <div className="space-y-3">
                    <div className="h-20 bg-dashboard-bg-tertiary animate-pulse rounded"></div>
                  </div>
                </div>
              ) : (
                <div className="bg-dashboard-bg-secondary rounded-lg p-6 border border-dashboard-border hover:border-dashboard-accent transition-colors">
                  <p className="text-sm text-dashboard-text-secondary font-medium">
                    Total de Admins
                  </p>
                  <p className="text-4xl font-bold text-dashboard-text-primary mt-2">
                    {admins.length}
                  </p>
                  <p className="text-xs text-dashboard-text-tertiary mt-1">
                    {admins.filter((a) => a.status === "active").length} ativos
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Lista de Admins */}
          <div className="px-4 mb-8">
            <div className="bg-dashboard-bg-secondary rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-dashboard-text-primary">
                  Admins
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCreateAdmin(true)}
                    className="px-3 py-1 text-sm bg-dashboard-accent hover:bg-dashboard-accent-hover rounded transition text-black font-bold"
                  >
                    + Criar Admin
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dashboard-accent" />
                </div>
              ) : filteredAdmins.length === 0 ? (
                <div className="text-center py-8 text-dashboard-text-secondary">
                  <p>
                    {admins.length === 0
                      ? "Nenhum admin encontrado"
                      : "Nenhum admin encontrado para a busca atual"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto scrollbar scrollbar-thin scrollbar-thumb-dashboard-accent scrollbar-track-dashboard-bg-tertiary">
                  {filteredAdmins.map((admin: any, idx: number) => (
                    <div
                      key={admin._id ?? admin.email ?? `admin-${idx}`}
                      className="border border-dashboard-border rounded-lg p-4 hover:bg-dashboard-border transition bg-dashboard-bg-tertiary"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-dashboard-text-primary">
                            {admin.name}
                          </h3>
                          <p className="text-sm text-dashboard-text-secondary mt-1">
                            {admin.email}
                          </p>
                          {admin.cnpj_admin && (
                            <p className="text-xs text-dashboard-text-tertiary mt-1">
                              CNPJ: {admin.cnpj_admin}
                            </p>
                          )}
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded font-bold ${
                            admin.type === "superadmin"
                              ? "bg-yellow-700 text-yellow-100"
                              : "bg-purple-900 text-purple-100"
                          }`}
                        >
                          {admin.type === "superadmin" ? "Superadmin" : "Admin"}
                        </span>
                      </div>
                      {isSuperadmin && (
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => handleEditAdmin(admin)}
                            className="px-3 py-1 text-xs rounded bg-dashboard-accent text-black font-bold hover:bg-dashboard-accent-hover transition"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteAdmin(admin)}
                            className="px-3 py-1 text-xs rounded bg-red-700 text-white font-bold hover:bg-red-600 transition"
                          >
                            Deletar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {showCreateAdmin && (
            <CreateAdminModal
              closeModal={() => setShowCreateAdmin(false)}
              onSuccess={() => {
                setShowCreateAdmin(false);
                loadAdmins();
              }}
            />
          )}

          {editingAdmin && (
            <EditEntityModal
              entityType="admin"
              entity={editingAdmin}
              isSuperadmin={isSuperadmin}
              isSaving={savingEdit}
              onClose={() => setEditingAdmin(null)}
              onSave={handleSaveAdmin}
            />
          )}
        </BodyContent>
      </div>
    </PermissionGuard>
  );
}

export default GerenciarAdminsPage;
