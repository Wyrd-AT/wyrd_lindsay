/// <reference types="vite/client" />
/**
 * Modal para criar admin/superadmin
 * Superadmin escolhe a equipe:
 *   - Sua equipe → cria superadmin (herda cnpj)
 *   - Equipe de outro admin → cria admin (herda cnpj do admin)
 *   - Equipe nova → cria admin (informa CNPJ)
 * Admin regular: sempre cria admin na mesma equipe (backend herda cnpj)
 */

import React, { useState, useEffect } from "react";
import { useAuthStore } from "../../stores/new/authStore";
import { createAdmin, fetchAdmins } from "../../api/new/fastapi-admin";
import {
  formatPhoneMask,
  getRawPhone,
  isPhoneValid,
} from "../../utils/phoneUtils";

interface CreateAdminModalProps {
  closeModal: () => void;
  onSuccess: () => void;
}

const formatDocumento = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

interface TeamOption {
  cnpj: string;
  label: string;
  isSuperadminTeam: boolean;
}

export const CreateAdminModal: React.FC<CreateAdminModalProps> = ({
  closeModal,
  onSuccess,
}) => {
  const user = useAuthStore((state) => state.user);
  const isSuperadmin = user?.type === "superadmin";

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone_number: "",
  });
  const [selectedTeam, setSelectedTeam] = useState<string>(user?.cnpj || "");
  const [newCnpj, setNewCnpj] = useState("");
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNewTeam = selectedTeam === "__new__";

  // Carregar equipes existentes
  useEffect(() => {
    if (!isSuperadmin) return;
    const load = async () => {
      setLoadingTeams(true);
      try {
        const response: any = await fetchAdmins();
        if (response?.admins) {
          const teamsMap = new Map<string, TeamOption>();
          for (const admin of response.admins) {
            const cnpj = admin.cnpj_admin;
            if (cnpj && !teamsMap.has(cnpj)) {
              const isMine = cnpj === user?.cnpj;
              teamsMap.set(cnpj, {
                cnpj,
                label: isMine
                  ? `Minha equipe (${admin.name} — ${cnpj})`
                  : `${admin.name} — ${cnpj}`,
                isSuperadminTeam: isMine,
              });
            }
          }
          // Minha equipe primeiro
          const sorted = Array.from(teamsMap.values()).sort((a, b) =>
            a.isSuperadminTeam ? -1 : b.isSuperadminTeam ? 1 : 0,
          );
          setTeams(sorted);
        }
      } catch {
        // silencioso
      } finally {
        setLoadingTeams(false);
      }
    };
    load();
  }, [isSuperadmin, user?.cnpj]);

  const isCnpjValid = (() => {
    if (!isNewTeam) return true;
    const digits = newCnpj.replace(/\D/g, "");
    return digits.length === 11 || digits.length === 14;
  })();

  // Determinar tipo baseado na equipe selecionada
  const resolveType = (): string => {
    if (!isSuperadmin) return "admin";
    if (isNewTeam) return "admin";
    const team = teams.find((t) => t.cnpj === selectedTeam);
    return team?.isSuperadminTeam ? "superadmin" : "admin";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isNewTeam && !isCnpjValid) {
      setError("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const newType = resolveType();
      const cnpj = isNewTeam
        ? newCnpj
        : selectedTeam !== user?.cnpj
          ? selectedTeam
          : undefined;

      await createAdmin({
        email: form.email,
        password: form.password,
        name: form.name,
        new_type: isSuperadmin ? newType : undefined,
        cnpj_admin: cnpj,
        phone_number: getRawPhone(form.phone_number),
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar admin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-dashboard-bg-secondary rounded-lg p-6 w-full max-w-md border border-dashboard-border shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-dashboard-text-primary">
            Criar Admin
          </h2>
          <button
            onClick={closeModal}
            className="text-dashboard-text-secondary hover:text-white text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSuperadmin && (
            <div>
              <label className="block text-sm text-dashboard-text-secondary mb-1">
                Equipe
              </label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full bg-dashboard-bg-tertiary border border-dashboard-border rounded px-3 py-2 text-dashboard-text-primary focus:outline-none focus:border-dashboard-accent"
                disabled={loadingTeams}
              >
                {loadingTeams ? (
                  <option>Carregando equipes...</option>
                ) : (
                  <>
                    {teams.map((t) => (
                      <option key={t.cnpj} value={t.cnpj}>
                        {t.label}
                      </option>
                    ))}
                    <option value="__new__">
                      + Criar equipe nova (informar CNPJ)
                    </option>
                  </>
                )}
              </select>
              <span className="text-xs text-dashboard-text-tertiary mt-1 block">
                {isNewTeam
                  ? "Será criado um admin independente com seu próprio CNPJ"
                  : selectedTeam === user?.cnpj
                    ? "Será criado um superadmin com os mesmos poderes"
                    : "Será criado um admin na equipe selecionada"}
              </span>
            </div>
          )}

          <div>
            <label className="block text-sm text-dashboard-text-secondary mb-1">
              Nome
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-dashboard-bg-tertiary border border-dashboard-border rounded px-3 py-2 text-dashboard-text-primary focus:outline-none focus:border-dashboard-accent"
              placeholder="Nome completo"
            />
          </div>

          <div>
            <label className="block text-sm text-dashboard-text-secondary mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-dashboard-bg-tertiary border border-dashboard-border rounded px-3 py-2 text-dashboard-text-primary focus:outline-none focus:border-dashboard-accent"
              placeholder="email@exemplo.com"
            />
          </div>

          <div>
            <label className="block text-sm text-dashboard-text-secondary mb-1 text-white">
              Celular / WhatsApp
            </label>
            <input
              type="tel"
              required
              value={form.phone_number} // ou `phoneNumber` se não for objeto
              onChange={(e) =>
                setForm({
                  ...form,
                  phone_number: formatPhoneMask(e.target.value),
                })
              }
              className={`w-full bg-dashboard-bg-tertiary border rounded px-3 py-2 text-dashboard-text-primary focus:outline-none ${
                form.phone_number && !isPhoneValid(form.phone_number)
                  ? "border-red-500 focus:border-red-500"
                  : "border-dashboard-border focus:border-dashboard-accent"
              }`}
              placeholder="+55 (11) 99999-9999"
            />
            {form.phone_number && !isPhoneValid(form.phone_number) && (
              <span className="text-xs text-red-400 block mt-1">
                Número incompleto.
              </span>
            )}
          </div>

          <div>
            <label className="block text-sm text-dashboard-text-secondary mb-1">
              Senha
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-dashboard-bg-tertiary border border-dashboard-border rounded px-3 py-2 text-dashboard-text-primary focus:outline-none focus:border-dashboard-accent"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          {isNewTeam && (
            <div>
              <label className="block text-sm text-dashboard-text-secondary mb-1">
                CNPJ ou CPF do novo Admin
              </label>
              <input
                type="text"
                required
                value={newCnpj}
                onChange={(e) => setNewCnpj(formatDocumento(e.target.value))}
                className={`w-full bg-dashboard-bg-tertiary border rounded px-3 py-2 text-dashboard-text-primary focus:outline-none ${
                  newCnpj && !isCnpjValid
                    ? "border-red-500 focus:border-red-500"
                    : "border-dashboard-border focus:border-dashboard-accent"
                }`}
                placeholder="XX.XXX.XXX/0001-XX ou XXX.XXX.XXX-XX"
              />
              {newCnpj && !isCnpjValid && (
                <span className="text-xs text-red-400 block mt-1">
                  Documento incompleto ({newCnpj.replace(/\D/g, "").length}{" "}
                  dígitos)
                </span>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={closeModal}
              className="flex-1 px-4 py-2 bg-dashboard-bg-tertiary hover:bg-dashboard-border text-white rounded transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={
                loading || !isCnpjValid || !isPhoneValid(form.phone_number)
              }
              className="flex-1 px-4 py-2 bg-dashboard-accent hover:bg-dashboard-accent-hover disabled:bg-gray-600 disabled:text-gray-400 text-black font-bold rounded transition"
            >
              {loading ? "Criando..." : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
