import React, { useEffect, useMemo, useState } from "react";
import { fetchAdmins } from "../../api/new/fastapi-admin";

type EntityType = "admin" | "revenda" | "cliente";

interface EditEntityModalProps {
  entityType: EntityType;
  entity: any;
  isSuperadmin: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, any>) => Promise<void>;
}

const SUB_ROLE_OPTIONS = ["superusuario", "gerente", "comum"] as const;

interface AdminOption {
  cnpj: string;
  label: string;
}

export function EditEntityModal({
  entityType,
  entity,
  isSuperadmin,
  isSaving,
  onClose,
  onSave,
}: EditEntityModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [adminOptions, setAdminOptions] = useState<AdminOption[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  const title = useMemo(() => {
    if (entityType === "admin") return "Editar Admin/Superadmin";
    if (entityType === "revenda") return "Editar Revenda";
    return "Editar Cliente";
  }, [entityType]);

  useEffect(() => {
    const base: Record<string, any> = {
      name: entity?.name || "",
    };

    if (entityType === "admin") {
      base.cnpj_admin = entity?.cnpj_admin || "";
    } else if (entityType === "revenda") {
      base.cnpj_revenda = entity?.cnpj_revenda || entity?.cnpj || "";
      base.cnpj_admin = entity?.cnpj_admin || "";
    } else {
      base.sub_role = entity?.sub_role || "superusuario";
      base.cnpj_cliente = entity?.cnpj_cliente || entity?.documento || "";
      base.revenda_id = entity?.revenda_id || "";
      base.cnpj_revenda = entity?.cnpj_revenda || "";
      base.cnpj_admin = entity?.cnpj_admin || "";
    }

    setForm(base);
    setError(null);
  }, [entity, entityType]);

  useEffect(() => {
    const needsAdminList =
      isSuperadmin &&
      (entityType === "admin" || entityType === "revenda" || entityType === "cliente");

    if (!needsAdminList) {
      setAdminOptions([]);
      return;
    }

    let cancelled = false;
    const loadAdmins = async () => {
      setLoadingAdmins(true);
      try {
        const response: any = await fetchAdmins();
        const unique = new Map<string, AdminOption>();
        for (const admin of response?.admins || []) {
          const cnpj = admin?.cnpj_admin;
          if (!cnpj || unique.has(cnpj)) continue;
          const name = admin?.name || "Admin";
          const email = admin?.email || "sem-email";
          unique.set(cnpj, {
            cnpj,
            label: `${name} (${email}) - ${cnpj}`,
          });
        }
        if (!cancelled) setAdminOptions(Array.from(unique.values()));
      } catch {
        if (!cancelled) setAdminOptions([]);
      } finally {
        if (!cancelled) setLoadingAdmins(false);
      }
    };

    loadAdmins();
    return () => {
      cancelled = true;
    };
  }, [entityType, isSuperadmin]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose, isSaving]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name?.trim()) {
      setError("Nome é obrigatório.");
      return;
    }
    if (entityType === "cliente" && !SUB_ROLE_OPTIONS.includes(form.sub_role)) {
      setError("Sub-role inválida.");
      return;
    }

    const payload: Record<string, any> = {
      name: form.name.trim(),
    };

    if (entityType === "admin") {
      if (isSuperadmin) payload.cnpj_admin = form.cnpj_admin?.trim() || null;
    }
    if (entityType === "revenda") {
      payload.cnpj_revenda = form.cnpj_revenda?.trim() || null;
      if (isSuperadmin) payload.cnpj_admin = form.cnpj_admin?.trim() || null;
    }
    if (entityType === "cliente") {
      payload.sub_role = form.sub_role;
      payload.cnpj_cliente = form.cnpj_cliente?.trim() || null;
      if (isSuperadmin) {
        payload.revenda_id = form.revenda_id?.trim() || null;
        payload.cnpj_revenda = form.cnpj_revenda?.trim() || null;
        payload.cnpj_admin = form.cnpj_admin?.trim() || null;
      }
    }

    try {
      await onSave(payload);
    } catch (err: any) {
      setError(err?.message || "Erro ao salvar alterações.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-lg border border-dashboard-border bg-dashboard-bg-secondary p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-dashboard-text-primary">{title}</h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-2xl leading-none text-dashboard-text-secondary hover:text-white disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-700 bg-red-900/40 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-dashboard-text-secondary">Nome</label>
            <input
              value={form.name || ""}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              className="w-full rounded border border-dashboard-border bg-dashboard-bg-tertiary px-3 py-2 text-dashboard-text-primary focus:outline-none focus:border-dashboard-accent"
            />
          </div>

          {entityType === "admin" && isSuperadmin && (
            <div>
              <label className="mb-1 block text-sm text-dashboard-text-secondary">CNPJ Admin</label>
              <input
                value={form.cnpj_admin || ""}
                onChange={(e) =>
                  setForm((s) => ({ ...s, cnpj_admin: e.target.value }))
                }
                placeholder="Digite o CNPJ do admin"
                className="w-full rounded border border-dashboard-border bg-dashboard-bg-tertiary px-3 py-2 text-dashboard-text-primary focus:outline-none focus:border-dashboard-accent"
              />
            </div>
          )}

          {entityType === "revenda" && (
            <>
              <div>
                <label className="mb-1 block text-sm text-dashboard-text-secondary">CNPJ Revenda</label>
                <input
                  value={form.cnpj_revenda || ""}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, cnpj_revenda: e.target.value }))
                  }
                  className="w-full rounded border border-dashboard-border bg-dashboard-bg-tertiary px-3 py-2 text-dashboard-text-primary focus:outline-none focus:border-dashboard-accent"
                />
              </div>
              {isSuperadmin && (
                <div>
                  <label className="mb-1 block text-sm text-dashboard-text-secondary">CNPJ Admin</label>
                  <select
                    value={form.cnpj_admin || ""}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, cnpj_admin: e.target.value }))
                    }
                    className="w-full rounded border border-dashboard-border bg-dashboard-bg-tertiary px-3 py-2 text-dashboard-text-primary focus:outline-none focus:border-dashboard-accent"
                    disabled={loadingAdmins}
                  >
                    <option value="">
                      {loadingAdmins ? "Carregando admins..." : "Selecione um admin"}
                    </option>
                    {adminOptions.map((opt) => (
                      <option key={opt.cnpj} value={opt.cnpj}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {entityType === "cliente" && (
            <>
              <div>
                <label className="mb-1 block text-sm text-dashboard-text-secondary">Sub-role</label>
                <select
                  value={form.sub_role || "superusuario"}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, sub_role: e.target.value }))
                  }
                  className="w-full rounded border border-dashboard-border bg-dashboard-bg-tertiary px-3 py-2 text-dashboard-text-primary focus:outline-none focus:border-dashboard-accent"
                >
                  {SUB_ROLE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-dashboard-text-secondary">CNPJ/CPF Cliente</label>
                <input
                  value={form.cnpj_cliente || ""}
                  onChange={(e) =>
                    setForm((s) => ({ ...s, cnpj_cliente: e.target.value }))
                  }
                  className="w-full rounded border border-dashboard-border bg-dashboard-bg-tertiary px-3 py-2 text-dashboard-text-primary focus:outline-none focus:border-dashboard-accent"
                />
              </div>
              {isSuperadmin && (
                <>
                  
                  <div>
                    <label className="mb-1 block text-sm text-dashboard-text-secondary">CNPJ Revenda</label>
                    <input
                      value={form.cnpj_revenda || ""}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, cnpj_revenda: e.target.value }))
                      }
                      className="w-full rounded border border-dashboard-border bg-dashboard-bg-tertiary px-3 py-2 text-dashboard-text-primary focus:outline-none focus:border-dashboard-accent"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-dashboard-text-secondary">CNPJ Admin</label>
                    <select
                      value={form.cnpj_admin || ""}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, cnpj_admin: e.target.value }))
                      }
                      className="w-full rounded border border-dashboard-border bg-dashboard-bg-tertiary px-3 py-2 text-dashboard-text-primary focus:outline-none focus:border-dashboard-accent"
                      disabled={loadingAdmins}
                    >
                      <option value="">
                        {loadingAdmins ? "Carregando admins..." : "Selecione um admin"}
                      </option>
                      {adminOptions.map((opt) => (
                        <option key={opt.cnpj} value={opt.cnpj}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 rounded bg-dashboard-bg-tertiary px-4 py-2 text-white transition hover:bg-dashboard-border disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 rounded bg-dashboard-accent px-4 py-2 font-bold text-black transition hover:bg-dashboard-accent-hover disabled:bg-gray-600 disabled:text-gray-300"
            >
              {isSaving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditEntityModal;
