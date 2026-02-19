/**
 * Componente: Fila de Aprovações de Revendas
 * Exibe revendas pendentes e permite aprovar/rejeitar
 * Para uso exclusivo de Admins
 */

import React, { useEffect, useState } from 'react';
import { useAdminRevendas } from '../../hooks/new/useAdminRevendas';
import type { Revenda } from '../../types/admin';

interface RevendaPendingApprovalsProps {
  onApprovalChange?: () => void; // Callback para refresh de outras seções
}

export const RevendaPendingApprovals: React.FC<RevendaPendingApprovalsProps> = ({
  onApprovalChange,
}) => {
  const { pendingRevendas, loading, error, fetchPendingRevendas, approveRevenda, rejectRevenda } =
    useAdminRevendas();
  const [selectedRevenda, setSelectedRevenda] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  // Carregar revendas pendentes ao montar
  useEffect(() => {
    fetchPendingRevendas();
  }, [fetchPendingRevendas]);

  const handleApprove = async (revenda: Revenda) => {
    if (!confirm(`Aprovar revenda "${revenda.name}" (${revenda.email})?`)) {
      return;
    }

    setApproving(true);
    try {
      await approveRevenda(revenda.email);
      setSelectedRevenda(null);
      if (onApprovalChange) {
        onApprovalChange();
      }
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async (revenda: Revenda) => {
    const reason = prompt(`Motivo da rejeição de "${revenda.name}":`);
    if (!reason) return;

    setRejecting(true);
    try {
      await rejectRevenda(revenda.email);
      setSelectedRevenda(null);
      if (onApprovalChange) {
        onApprovalChange();
      }
    } finally {
      setRejecting(false);
    }
  };

  if (loading && pendingRevendas.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500 mx-auto mb-2"></div>
          <p className="text-gray-400">Carregando revendas pendentes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#333333] rounded-lg p-6 border border-gray-600">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-white">📋 Revendas Pendentes</h2>
          <p className="text-sm text-gray-400 mt-1">
            {pendingRevendas.length} revenda(s) aguardando aprovação
          </p>
        </div>
        <button
          onClick={fetchPendingRevendas}
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
      {pendingRevendas.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">✅ Nenhuma revenda pendente!</p>
          <p className="text-gray-500 text-sm mt-2">Todas as revendas já foram aprovadas ou rejeitadas.</p>
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {pendingRevendas.map((revenda) => (
          <div
            key={revenda._id}
            onClick={() => setSelectedRevenda(selectedRevenda === revenda._id ? null : revenda._id)}
            className="bg-[#444444] border border-gray-500 rounded p-4 cursor-pointer hover:border-yellow-500 hover:bg-[#4a4a4a] transition"
          >
            {/* Card Header */}
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-white">
                  🏢 {revenda.name}
                  <span className="ml-2 text-xs bg-yellow-600 text-white px-2 py-1 rounded">
                    PENDENTE
                  </span>
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  📧 {revenda.email}
                </p>
                {revenda.cnpj_revenda && (
                  <p className="text-sm text-gray-500 mt-1">
                    🔢 CNPJ: {revenda.cnpj_revenda}
                  </p>
                )}
                <p className="text-xs text-gray-600 mt-2">
                  📅 {new Date(revenda.created_at).toLocaleString('pt-BR')}
                </p>
              </div>

              {/* Indicator */}
              <span className="text-2xl">
                {selectedRevenda === revenda._id ? '▼' : '▶'}
              </span>
            </div>

            {/* Expanded Content */}
            {selectedRevenda === revenda._id && (
              <div className="mt-4 pt-4 border-t border-gray-600">
                {/* Details */}
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div>
                    <p className="text-gray-500 text-xs">ID</p>
                    <p className="text-gray-300 font-mono text-xs break-all">
                      {revenda._id.replace('revenda:', '')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Status</p>
                    <p className="text-yellow-400 font-semibold">PENDENTE</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApprove(revenda);
                    }}
                    disabled={approving || rejecting}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {approving ? '⏳ Aprovando...' : '✅ Aprovar'}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReject(revenda);
                    }}
                    disabled={approving || rejecting}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {rejecting ? '⏳ Rejeitando...' : '❌ Rejeitar'}
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
