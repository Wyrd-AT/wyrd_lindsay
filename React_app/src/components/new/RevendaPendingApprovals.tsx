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
    <div className="bg-dashboard-bg-secondary rounded-lg p-6 border border-dashboard-border">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-dashboard-text-primary">Revendas Pendentes</h2>
          <p className="text-sm text-dashboard-text-secondary mt-1">
            {pendingRevendas.length} revenda(s) aguardando aprovação
          </p>
        </div>
        <button
          onClick={fetchPendingRevendas}
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
      {pendingRevendas.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-dashboard-text-secondary text-lg">Nenhuma revenda pendente</p>
          <p className="text-dashboard-text-tertiary text-sm mt-2">Todas as revendas já foram aprovadas ou rejeitadas.</p>
        </div>
      )}

      {/* List */}
      <div className="space-y-3 max-h-96 overflow-y-auto scrollbar scrollbar-thin scrollbar-thumb-dashboard-accent scrollbar-track-dashboard-bg-tertiary">
        {pendingRevendas.map((revenda) => (
          <div
            key={revenda._id}
            onClick={() => setSelectedRevenda(selectedRevenda === revenda._id ? null : revenda._id)}
            className="bg-dashboard-bg-tertiary border border-dashboard-border rounded p-4 cursor-pointer hover:bg-dashboard-border transition"
          >
            {/* Card Header */}
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-dashboard-text-primary">
                  {revenda.name}
                  <span className="ml-2 text-xs bg-yellow-900 text-yellow-100 px-2 py-1 rounded">
                    Pendente
                  </span>
                </h3>
                <p className="text-sm text-dashboard-text-secondary mt-1">
                  {revenda.email}
                </p>
                {revenda.cnpj_revenda && (
                  <p className="text-sm text-dashboard-text-tertiary mt-1">
                    CNPJ: {revenda.cnpj_revenda}
                  </p>
                )}
                <p className="text-xs text-dashboard-text-tertiary mt-2">
                  {new Date(revenda.created_at).toLocaleString('pt-BR')}
                </p>
              </div>

              {/* Indicator */}
              <span className="text-dashboard-text-secondary">
                {selectedRevenda === revenda._id ? '▼' : '▶'}
              </span>
            </div>

            {/* Expanded Content */}
            {selectedRevenda === revenda._id && (
              <div className="mt-4 pt-4 border-t border-dashboard-border">
                {/* Details */}
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div>
                    <p className="text-dashboard-text-tertiary text-xs">ID</p>
                    <p className="text-dashboard-text-secondary font-mono text-xs break-all">
                      {revenda._id.replace('revenda:', '')}
                    </p>
                  </div>
                  <div>
                    <p className="text-dashboard-text-tertiary text-xs">Status</p>
                    <p className="text-yellow-400 font-semibold">Pendente</p>
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
                    className="flex-1 px-4 py-2 bg-green-900 hover:bg-green-800 text-green-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition font-bold"
                  >
                    {approving ? 'Aprovando...' : 'Aprovar'}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReject(revenda);
                    }}
                    disabled={approving || rejecting}
                    className="flex-1 px-4 py-2 bg-red-900 hover:bg-red-800 text-red-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition font-bold"
                  >
                    {rejecting ? 'Rejeitando...' : 'Rejeitar'}
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
