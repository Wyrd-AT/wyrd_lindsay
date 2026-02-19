/**
 * Hook para gerenciar clientes (Admin view)
 * - Listar todos os clientes
 * - Listar clientes por status
 */

import { useCallback, useState } from 'react';
import { useAuthStore } from '../../stores/new/authStore';
import type { Cliente } from '../../types/admin';

interface UseAdminClientesReturn {
  clientes: Cliente[];
  loading: boolean;
  error: string | null;
  fetchClientes: () => Promise<void>;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const useAdminClientes = (): UseAdminClientesReturn => {
  const token = useAuthStore((state) => state.token);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fazer request autenticado
   */
  const makeRequest = useCallback(
    async (endpoint: string) => {
      if (!token) {
        throw new Error('Não autenticado');
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      return response.json();
    },
    [token]
  );

  /**
   * Buscar todos os clientes
   */
  const fetchClientes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await makeRequest('/api/clientes');
      setClientes(data.clientes || []);
      console.log('✅ Clientes carregados:', data.clientes?.length || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar clientes';
      setError(message);
      console.error('❌ Erro ao buscar clientes:', err);
    } finally {
      setLoading(false);
    }
  }, [makeRequest]);

  return {
    clientes,
    loading,
    error,
    fetchClientes,
  };
};
