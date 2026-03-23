/**
 * Componente: Fila de Aprovações de Clientes
 * Refatorado para utilizar o apiClient (Axios)
 * Para uso exclusivo de Revendas
 */

import React, { useEffect, useState } from "react";
import { useAuthStore } from "../../stores/new/authStore";
import type { Cliente } from "../../types/admin";
import apiClient from "../../api/new/apiClient"; // 👈 Ajuste o caminho se necessário

interface ClientePendingApprovalsProps {
  onApprovalChange?: () => void;
}

export const ClientePendingApprovals: React.FC<
  ClientePendingApprovalsProps
> = ({ onApprovalChange }) => {
  const token = useAuthStore((state) => state.token);

  const [pendingClientes, setPendingClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Carregar clientes pendentes
  const loadPendingClientes = async () => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      // O prefixo /api já está na baseURL do seu apiClient
      const response = await apiClient.get("/clientes/pending");

      // No Axios, os dados retornados ficam em .data
      setPendingClientes(response.data.clientes || []);
    } catch (err: any) {
      // Captura o erro detalhado enviado pelo FastAPI ou Axios
      const message =
        err.response?.data?.detail || err.message || "Erro ao carregar";
      setError(message);
      console.error("❌ Erro ao carregar clientes pendentes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingClientes();
  }, [token]);

  const handleApprove = async (cliente: Cliente) => {
    if (!confirm(`Aprovar cliente "${cliente.name}" (${cliente.email})?`)) {
      return;
    }

    setActionLoading(true);
    try {
      // Usando diretamente o apiClient para o POST
      await apiClient.post(`/clientes/${cliente.email}/approve`);

      setPendingClientes((prev) =>
        prev.filter((c) => c.email !== cliente.email),
      );
      setSelectedCliente(null);
      if (onApprovalChange) onApprovalChange();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao aprovar");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (cliente: Cliente) => {
    if (!confirm(`Rejeitar cliente "${cliente.name}" (${cliente.email})?`)) {
      return;
    }

    setActionLoading(true);
    try {
      // Usando diretamente o apiClient para o POST
      await apiClient.post(`/clientes/${cliente.email}/reject`);

      setPendingClientes((prev) =>
        prev.filter((c) => c.email !== cliente.email),
      );
      setSelectedCliente(null);
      if (onApprovalChange) onApprovalChange();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erro ao rejeitar");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && pendingClientes.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
          <p className="text-dashboard-text-secondary">
            Carregando clientes pendentes...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-dashboard-bg-secondary rounded-lg p-6 border border-dashboard-border">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-dashboard-text-primary">
            Clientes Pendentes
          </h2>
          <p className="text-sm text-dashboard-text-secondary mt-1">
            {pendingClientes.length} cliente(s) aguardando aprovação
          </p>
        </div>
        <button
          onClick={loadPendingClientes}
          disabled={loading}
          className="px-3 py-2 bg-dashboard-accent hover:bg-dashboard-accent-hover text-white rounded text-sm disabled:opacity-50 font-bold transition"
        >
          Atualizar
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-900 border border-red-700 rounded text-red-100 text-sm">
          {error}
        </div>
      )}

      {/* Empty State */}
      {pendingClientes.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-dashboard-text-secondary text-lg">
            Nenhum cliente pendente
          </p>
          <p className="text-dashboard-text-tertiary text-sm mt-2">
            Todos os clientes já foram aprovados ou rejeitados.
          </p>
        </div>
      )}

      {/* List */}
      <div className="space-y-3 max-h-96 overflow-y-auto scrollbar scrollbar-thin scrollbar-thumb-dashboard-accent scrollbar-track-dashboard-bg-tertiary">
        {pendingClientes.map((cliente) => (
          <div
            key={cliente._id}
            onClick={() =>
              setSelectedCliente(
                selectedCliente === cliente._id ? null : cliente._id,
              )
            }
            className="bg-dashboard-bg-tertiary border border-dashboard-border rounded p-4 cursor-pointer hover:bg-dashboard-border transition"
          >
            {/* Card Header */}
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-dashboard-text-primary">
                  {cliente.name}
                  <span className="ml-2 text-xs bg-yellow-900 text-yellow-100 px-2 py-1 rounded">
                    Pendente
                  </span>
                </h3>
                <p className="text-sm text-dashboard-text-secondary mt-1">
                  {cliente.email}
                </p>
                <p className="text-xs text-dashboard-text-tertiary mt-2">
                  {new Date(cliente.created_at).toLocaleString("pt-BR")}
                </p>
              </div>

              {/* Indicator */}
              <span className="text-dashboard-text-secondary">
                {selectedCliente === cliente._id ? "▼" : "▶"}
              </span>
            </div>

            {/* Expanded Content */}
            {selectedCliente === cliente._id && (
              <div className="mt-4 pt-4 border-t border-dashboard-border">
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div>
                    <p className="text-dashboard-text-tertiary text-xs">ID</p>
                    <p className="text-dashboard-text-secondary font-mono text-xs break-all">
                      {cliente._id.replace("user:", "")}
                    </p>
                  </div>
                  <div>
                    <p className="text-dashboard-text-tertiary text-xs">
                      Status
                    </p>
                    <p className="text-yellow-400 font-semibold">Pendente</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApprove(cliente);
                    }}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 bg-green-900 hover:bg-green-800 text-green-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition font-bold"
                  >
                    {actionLoading ? "Aprovando..." : "Aprovar"}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReject(cliente);
                    }}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 bg-red-900 hover:bg-red-800 text-red-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition font-bold"
                  >
                    {actionLoading ? "Rejeitando..." : "Rejeitar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
