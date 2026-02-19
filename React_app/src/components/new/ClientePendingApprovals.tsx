/**
 * Componente: Fila de Aprovações de Clientes
 * Exibe clientes pendentes e permite aprovar/rejeitar
 * Para uso exclusivo de Revendas
 */

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../stores/new/authStore';
import type { Cliente } from '../../types/admin';

interface ClientePendingApprovalsProps {
  onApprovalChange?: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const ClientePendingApprovals: React.FC<ClientePendingApprovalsProps> = ({
  onApprovalChange,
}) => {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);

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
      const response = await fetch(`${API_BASE_URL}/api/clientes/pending`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setPendingClientes(data.clientes || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar';
      setError(message);
      console.error('❌ Erro ao carregar clientes pendentes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingClientes();
  }, [token]);

  const makeRequest = async (endpoint: string, method: string = 'POST') => {
    if (!token) throw new Error('Não autenticado');

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || `HTTP ${response.status}`);
    }

    return response.json();
  };

  const handleApprove = async (cliente: Cliente) => {
    if (!confirm(`Aprovar cliente "${cliente.name}" (${cliente.email})?`)) {
      return;
    }

    setActionLoading(true);
    try {
      await makeRequest(`/api/clientes/${cliente.email}/approve`);
      setPendingClientes((prev) => prev.filter((c) => c.email !== cliente.email));
      setSelectedCliente(null);
      if (onApprovalChange) onApprovalChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aprovar');
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
      await makeRequest(`/api/clientes/${cliente.email}/reject`);
      setPendingClientes((prev) => prev.filter((c) => c.email !== cliente.email));
      setSelectedCliente(null);
      if (onApprovalChange) onApprovalChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao rejeitar');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && pendingClientes.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-gray-400">Carregando clientes pendentes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#333333] rounded-lg p-6 border border-gray-600">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">👥 Clientes Pendentes</h2>
          <p className="text-sm text-gray-400 mt-1">
            {pendingClientes.length} cliente(s) aguardando aprovação
          </p>
        </div>
        <button
          onClick={loadPendingClientes}
          disabled={loading}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm disabled:opacity-50"
        >
          🔄 Atualizar
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
          ❌ {error}
        </div>
      )}

      {/* Empty State */}
      {pendingClientes.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">✅ Nenhum cliente pendente!</p>
          <p className="text-gray-500 text-sm mt-2">Todos os clientes já foram aprovados ou rejeitados.</p>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {pendingClientes.map((cliente) => (
          <div
            key={cliente._id}
            onClick={() => setSelectedCliente(selectedCliente === cliente._id ? null : cliente._id)}
            className="bg-[#444444] border border-gray-500 rounded p-4 cursor-pointer hover:border-blue-500 hover:bg-[#4a4a4a] transition"
          >
            {/* Card Header */}
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-white">
                  👤 {cliente.name}
                  <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded">
                    PENDENTE
                  </span>
                </h3>
                <p className="text-sm text-gray-400 mt-1">📧 {cliente.email}</p>
                <p className="text-xs text-gray-600 mt-2">
                  📅 {new Date(cliente.created_at).toLocaleString('pt-BR')}
                </p>
              </div>

              <span className="text-2xl">
                {selectedCliente === cliente._id ? '▼' : '▶'}
              </span>
            </div>

            {/* Expanded Content */}
            {selectedCliente === cliente._id && (
              <div className="mt-4 pt-4 border-t border-gray-600">
                <div className="mb-4 text-sm">
                  <p className="text-gray-500 text-xs">ID</p>
                  <p className="text-gray-300 font-mono text-xs break-all">
                    {cliente._id.replace('user:', '')}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApprove(cliente);
                    }}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {actionLoading ? '⏳ Aprovando...' : '✅ Aprovar'}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReject(cliente);
                    }}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {actionLoading ? '⏳ Rejeitando...' : '❌ Rejeitar'}
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
