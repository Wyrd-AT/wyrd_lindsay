import React, { useEffect, useState, useCallback } from 'react';
import { useAuthStore, selectIsAdmin, selectIsRevenda, selectIsActiveUser } from '../../stores/new/authStore';

export interface PendingItem {
  _id: string;
  _rev?: string;
  type: 'revenda' | 'cliente';
  email: string;
  name: string;
  domain?: string; // para revendas
  created_at: string;
  status: 'pending';
}

export interface ApprovalQueueProps {
  /** Callback quando um item é aprovado */
  onApprove?: (item: PendingItem) => void;
  /** Callback quando um item é rejeitado */
  onReject?: (item: PendingItem) => void;
  /** Callback de erro */
  onError?: (error: Error) => void;
  /** Função para buscar revendas pendentes (para admin) */
  fetchPendingRevendas?: () => Promise<PendingItem[]>;
  /** Função para buscar clientes pendentes (para revenda) */
  fetchPendingClientes?: () => Promise<PendingItem[]>;
}

/**
 * Componente que exibe fila de aprovações baseado no role do usuário:
 * - Admins: aprovações de revendas
 * - Revendas: aprovações de clientes
 *
 * @example
 * ```tsx
 * <ApprovalQueue
 *   fetchPendingRevendas={api.getPendingRevendas}
 *   fetchPendingClientes={api.getPendingClientes}
 *   onApprove={(item) => handleApprove(item)}
 *   onReject={(item) => handleReject(item)}
 * />
 * ```
 */
export function ApprovalQueue({
  onApprove,
  onReject,
  onError,
  fetchPendingRevendas,
  fetchPendingClientes,
}: ApprovalQueueProps) {
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authState = useAuthStore();
  const isAdmin = selectIsAdmin(authState);
  const isRevenda = selectIsRevenda(authState);
  const isActiveUser = selectIsActiveUser(authState);

  // Carregar itens pendentes com base no role
  const loadPendingItems = useCallback(async () => {
    if (!isActiveUser) return;

    setLoading(true);
    setError(null);

    try {
      let items: PendingItem[] = [];

      if (isAdmin && fetchPendingRevendas) {
        items = await fetchPendingRevendas();
      } else if (isRevenda && fetchPendingClientes) {
        items = await fetchPendingClientes();
      }

      setPendingItems(items);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error.message);
      if (onError) {
        onError(error);
      }
    } finally {
      setLoading(false);
    }
  }, [isActiveUser, isAdmin, isRevenda, fetchPendingRevendas, fetchPendingClientes, onError]);

  // Carregar itens ao montar e quando user muda
  useEffect(() => {
    loadPendingItems();
  }, [loadPendingItems]);

  const handleApprove = useCallback(
    async (item: PendingItem) => {
      try {
        if (onApprove) {
          await onApprove(item);
        }
        // Remover do estado local
        setPendingItems((prev) => prev.filter((p) => p._id !== item._id));
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error.message);
        if (onError) {
          onError(error);
        }
      }
    },
    [onApprove, onError]
  );

  const handleReject = useCallback(
    async (item: PendingItem) => {
      try {
        if (onReject) {
          await onReject(item);
        }
        // Remover do estado local
        setPendingItems((prev) => prev.filter((p) => p._id !== item._id));
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error.message);
        if (onError) {
          onError(error);
        }
      }
    },
    [onReject, onError]
  );

  if (!isActiveUser) {
    return null;
  }

  const itemType = isAdmin ? 'Revenda' : isRevenda ? 'Cliente' : null;

  if (!itemType) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-800">
          {itemType}s Pendentes de Aprovação
        </h2>
        <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
          {pendingItems.length}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {!loading && pendingItems.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>Nenhum {itemType.toLowerCase()} pendente de aprovação</p>
        </div>
      )}

      {!loading && pendingItems.length > 0 && (
        <div className="space-y-4">
          {pendingItems.map((item) => (
            <ApprovalItem
              key={item._id}
              item={item}
              itemType={itemType}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Componente para exibir um item individual na fila de aprovação
 */
function ApprovalItem({
  item,
  itemType,
  onApprove,
  onReject,
}: {
  item: PendingItem;
  itemType: string;
  onApprove: (item: PendingItem) => void;
  onReject: (item: PendingItem) => void;
}) {
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const handleApproveClick = useCallback(async () => {
    setApproving(true);
    try {
      await onApprove(item);
    } finally {
      setApproving(false);
    }
  }, [item, onApprove]);

  const handleRejectClick = useCallback(async () => {
    setRejecting(true);
    try {
      await onReject(item);
    } finally {
      setRejecting(false);
    }
  }, [item, onReject]);

  const createdAt = new Date(item.created_at);
  const formattedDate = createdAt.toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const formattedTime = createdAt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-gray-800">{item.name}</h3>
            <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
              Pendente
            </span>
          </div>

          <div className="space-y-1 text-sm text-gray-600">
            <p>
              <span className="font-medium">Email:</span> {item.email}
            </p>
            {item.domain && (
              <p>
                <span className="font-medium">Domínio:</span> {item.domain}
              </p>
            )}
            <p>
              <span className="font-medium">Solicitado em:</span> {formattedDate} às{' '}
              {formattedTime}
            </p>
          </div>
        </div>

        <div className="flex gap-3 ml-4">
          <button
            onClick={handleApproveClick}
            disabled={approving || rejecting}
            className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
            title={`Aprovar ${itemType.toLowerCase()}`}
          >
            {approving ? '...' : '✓ Aprovar'}
          </button>

          <button
            onClick={handleRejectClick}
            disabled={approving || rejecting}
            className="bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
            title={`Rejeitar ${itemType.toLowerCase()}`}
          >
            {rejecting ? '...' : '✕ Rejeitar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApprovalQueue;
