/**
 * Modal para criar cliente
 * Refatorado para utilizar o apiClient (Axios)
 * Usado por admin (com seletor de revenda) e revenda (revenda_id auto-preenchido)
 */

import React, { useState } from "react";
import { useAuthStore } from "../../stores/new/authStore";
import apiClient from "../../api/new/apiClient"; // 👈 Ajuste o caminho se necessário

interface Revenda {
  id?: string;
  doc_id?: string;
  _id?: string;
  name: string;
  email: string;
}

interface CreateClienteModalProps {
  closeModal: () => void;
  onSuccess: () => void;
  revendas?: Revenda[];
  /** Quando false (contexto de revenda), oculta o seletor de revenda e não faz fetch */
  showRevendaField?: boolean;
}

export const CreateClienteModal: React.FC<CreateClienteModalProps> = ({
  closeModal,
  onSuccess,
  revendas,
}) => {
  const token = useAuthStore((state) => state.token);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    cnpj_cliente: "",
    revenda_id: "",
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

  // Valida se tem 11, 14 ou 0 dígitos
  const isDocumentoValid = (() => {
    const digits = form.cnpj_cliente.replace(/\D/g, "");
    return digits.length === 11 || digits.length === 14 || digits.length === 0;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const digitsLength = form.cnpj_cliente.replace(/\D/g, "").length;
    if (digitsLength !== 11 && digitsLength !== 14) {
      setError("Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.");
      return;
    }

    // Validar revenda_id obrigatório para admin
    if (revendas !== undefined && !form.revenda_id) {
      setError("A seleção de uma revenda é obrigatória.");
      return;
    }

    setLoading(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      password: form.password,
      cnpj_cliente: form.cnpj_cliente,
    };
    if (revendas !== undefined) {
      payload.revenda_id = form.revenda_id;
    }

    try {
      // O apiClient já gerencia o prefixo /api e o Bearer Token
      await apiClient.post("/clientes", payload);
      onSuccess();
    } catch (err: any) {
      // Captura o erro detalhado vindo do FastAPI através do Axios
      setError(
        err.response?.data?.detail || err.message || "Erro ao criar cliente",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-dashboard-bg-secondary rounded-lg p-6 w-full max-w-md border border-dashboard-border shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-dashboard-text-primary">
            Criar Cliente
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
              CNPJ ou CPF do Cliente
            </label>
            <input
              type="text"
              required
              value={form.cnpj_cliente}
              onChange={(e) =>
                setForm({
                  ...form,
                  cnpj_cliente: formatDocumento(e.target.value),
                })
              }
              className={`w-full bg-dashboard-bg-tertiary border rounded px-3 py-2 text-dashboard-text-primary focus:outline-none ${
                form.cnpj_cliente && !isDocumentoValid
                  ? "border-red-500 focus:border-red-500"
                  : "border-dashboard-border focus:border-dashboard-accent"
              }`}
              placeholder="XX.XXX.XXX/0001-XX ou XXX.XXX.XXX-XX"
            />
            {form.cnpj_cliente && !isDocumentoValid && (
              <span className="text-xs text-red-400 block mt-1">
                Documento incompleto (
                {form.cnpj_cliente.replace(/\D/g, "").length} dígitos)
              </span>
            )}
          </div>

          {/* Seletor de revenda (admin only — prop revendas é passada) */}
          {revendas && revendas.length > 0 && (
            <div>
              <label className="block text-sm text-dashboard-text-secondary mb-1">
                Revenda
                <span className="text-red-400 ml-1">*</span>
              </label>
              <select
                value={form.revenda_id}
                onChange={(e) =>
                  setForm({ ...form, revenda_id: e.target.value })
                }
                className="w-full bg-dashboard-bg-tertiary border border-dashboard-border rounded px-3 py-2 text-dashboard-text-primary focus:outline-none focus:border-dashboard-accent"
              >
                <option value="">Selecione uma revenda</option>
                {revendas.map((r) => (
                  <option key={r.doc_id ?? r.id ?? r._id} value={r.doc_id ?? r.id ?? r._id}>
                    {r.name} ({r.email})
                  </option>
                ))}
              </select>
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
                loading ||
                !isDocumentoValid ||
                (revendas !== undefined && !form.revenda_id)
              }
              className="flex-1 px-4 py-2 bg-dashboard-accent hover:bg-dashboard-accent-hover disabled:bg-gray-600 disabled:text-gray-400 text-black font-bold rounded transition"
            >
              {loading ? "Criando..." : "Criar Cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
