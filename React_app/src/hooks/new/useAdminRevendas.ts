/**
 * Hook para gerenciar revendas (Admin only)
 * - Listar revendas pendentes
 * - Listar todas as revendas
 * - Aprovar revenda
 * - Rejeitar revenda
 */

import { useCallback, useState } from 'react';
import { useAuthStore } from '../../stores/new/authStore';
import type { Revenda } from '../../types/admin';

interface UseAdminRevendasReturn {
  pendingRevendas: Revenda[];
  allRevendas: Revenda[];
  loading: boolean;
  error: string | null;
  fetchPendingRevendas: () => Promise<void>;
  fetchAllRevendas: () => Promise<void>;
  approveRevenda: (email: string) => Promise<void>;
  rejectRevenda: (email: string) => Promise<void>;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const useAdminRevendas = (): UseAdminRevendasReturn => {
  const token = useAuthStore((state) => state.token);
  const [pendingRevendas, setPendingRevendas] = useState<Revenda[]>([]);
  const [allRevendas, setAllRevendas] = useState<Revenda[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fazer request autenticado
   */
  const makeRequest = useCallback(
    async (endpoint: string, method: string = 'GET', body?: any) => {
      if (!token) {
        throw new Error('Não autenticado');
      }

      const options: RequestInit = {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      return response.json();
    },
    [token]
  );

  /**
   * Buscar revendas pendentes
   */
  const fetchPendingRevendas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await makeRequest('/api/revendas/pending');
      setPendingRevendas(data.revendas || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar revendas';
      setError(message);
      console.error('❌ Erro ao buscar revendas pendentes:', err);
    } finally {
      setLoading(false);
    }
  }, [makeRequest]);

  /**
   * Buscar todas as revendas
   */
  const fetchAllRevendas = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await makeRequest('/api/revendas');
      setAllRevendas(data.revendas || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar revendas';
      setError(message);
      console.error('❌ Erro ao buscar todas as revendas:', err);
    } finally {
      setLoading(false);
    }
  }, [makeRequest]);

  /**
   * Aprovar revenda
   */
  const approveRevenda = useCallback(
    async (email: string) => {
      setError(null);
      try {
        await makeRequest(`/api/revendas/${email}/approve`, 'POST');

        // Remover de pendentes e atualizar lista
        setPendingRevendas((prev) => prev.filter((r) => r.email !== email));

        console.log('✅ Revenda aprovada:', email);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao aprovar revenda';
        setError(message);
        console.error('❌ Erro ao aprovar revenda:', err);
        throw err;
      }
    },
    [makeRequest]
  );

  /**
   * Rejeitar revenda
   */
  const rejectRevenda = useCallback(
    async (email: string) => {
      setError(null);
      try {
        await makeRequest(`/api/revendas/${email}/reject`, 'POST');

        // Remover de pendentes
        setPendingRevendas((prev) => prev.filter((r) => r.email !== email));

        console.log('✅ Revenda rejeitada:', email);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao rejeitar revenda';
        setError(message);
        console.error('❌ Erro ao rejeitar revenda:', err);
        throw err;
      }
    },
    [makeRequest]
  );

  return {
    pendingRevendas,
    allRevendas,
    loading,
    error,
    fetchPendingRevendas,
    fetchAllRevendas,
    approveRevenda,
    rejectRevenda,
  };
};
