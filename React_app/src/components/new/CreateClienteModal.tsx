/// <reference types="vite/client" />
/**
 * Modal para criar cliente
 * Usado por admin (com seletor de revenda) e revenda (revenda_id auto-preenchido)
 */

import React, { useState } from "react";
import { useAuthStore } from "../../stores/new/authStore";

interface Revenda {
  _id: string;
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

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    setError(null);

    // Para revenda: não envia revenda_id — o backend preenche automaticamente
    // Para admin: envia o revenda_id selecionado (pode ser null)
    const payload: Record<string, unknown> = {
      name: form.name,
      email: form.email,
      password: form.password,
      cnpj_cliente: form.cnpj_cliente,
    };
    if (revendas !== undefined) {
      payload.revenda_id = form.revenda_id || null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/clientes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${response.status}`);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar cliente");
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
              CNPJ do Cliente
            </label>
            <input
              type="text"
              required
              value={form.cnpj_cliente}
              onChange={(e) =>
                setForm({ ...form, cnpj_cliente: e.target.value })
              }
              className="w-full bg-dashboard-bg-tertiary border border-dashboard-border rounded px-3 py-2 text-dashboard-text-primary focus:outline-none focus:border-dashboard-accent"
              placeholder="XX.XXX.XXX/0001-XX"
            />
          </div>

          {/* Seletor de revenda (admin only — prop revendas é passada) */}
          {revendas && revendas.length > 0 && (
            <div>
              <label className="block text-sm text-dashboard-text-secondary mb-1">
                Revenda (opcional)
              </label>
              <select
                value={form.revenda_id}
                onChange={(e) =>
                  setForm({ ...form, revenda_id: e.target.value })
                }
                className="w-full bg-dashboard-bg-tertiary border border-dashboard-border rounded px-3 py-2 text-dashboard-text-primary focus:outline-none focus:border-dashboard-accent"
              >
                <option value="">Sem revenda</option>
                {revendas.map((r) => (
                  <option key={r._id} value={r._id}>
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
              disabled={loading}
              className="flex-1 px-4 py-2 bg-dashboard-accent hover:bg-dashboard-accent-hover disabled:bg-gray-600 text-black font-bold rounded transition"
            >
              {loading ? "Criando..." : "Criar Cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
