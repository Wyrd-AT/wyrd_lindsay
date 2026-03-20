/// <reference types="vite/client" />
/**
 * Modal para admin criar outro admin
 */

import React, { useState } from "react";
import { createAdmin } from "../../api/new/fastapi-admin";

interface CreateAdminModalProps {
  closeModal: () => void;
  onSuccess: () => void;
}

export const CreateAdminModal: React.FC<CreateAdminModalProps> = ({
  closeModal,
  onSuccess,
}) => {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    cnpj_admin: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formata CPF ou CNPJ conforme a digitação
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

  // Valida se tem 11, 14 ou 0 dígitos (para não dar erro antes de digitar)
  const isDocumentoValid = (() => {
    const digits = form.cnpj_admin.replace(/\D/g, "");
    return digits.length === 11 || digits.length === 14 || digits.length === 0;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const digitsLength = form.cnpj_admin.replace(/\D/g, "").length;
    if (digitsLength !== 11 && digitsLength !== 14) {
      setError("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createAdmin({
        email: form.email,
        password: form.password,
        name: form.name,
        // Envia com a formatação da máscara preservada
        cnpj_admin: form.cnpj_admin,
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
      <div className="bg-dashboard-bg-secondary rounded-lg p-6 w-full max-w-md border border-dashboard-border shadow-xl">
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

          <div>
            <label className="block text-sm text-dashboard-text-secondary mb-1">
              CNPJ ou CPF do Admin
            </label>
            <input
              type="text"
              required
              value={form.cnpj_admin}
              onChange={(e) =>
                setForm({
                  ...form,
                  cnpj_admin: formatDocumento(e.target.value),
                })
              }
              className={`w-full bg-dashboard-bg-tertiary border rounded px-3 py-2 text-dashboard-text-primary focus:outline-none ${
                form.cnpj_admin && !isDocumentoValid
                  ? "border-red-500 focus:border-red-500"
                  : "border-dashboard-border focus:border-dashboard-accent"
              }`}
              placeholder="XX.XXX.XXX/0001-XX ou XXX.XXX.XXX-XX"
            />
            {form.cnpj_admin && !isDocumentoValid && (
              <span className="text-xs text-red-400 block mt-1">
                Documento incompleto (
                {form.cnpj_admin.replace(/\D/g, "").length} dígitos)
              </span>
            )}
          </div>

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
              disabled={loading || !isDocumentoValid}
              className="flex-1 px-4 py-2 bg-dashboard-accent hover:bg-dashboard-accent-hover disabled:bg-gray-600 disabled:text-gray-400 text-black font-bold rounded transition"
            >
              {loading ? "Criando..." : "Criar Admin"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
