/**
 * Hook para gerenciar pivôs de um cliente
 * - Listar pivôs do cliente
 * - Obter detalhes de um pivô
 */

import { useCallback, useState } from 'react';
import { useAuthStore } from '../../stores/new/authStore';
import type { Pivo } from '../../types/admin';

interface UseClientePivosReturn {
  pivos: Pivo[];
  loading: boolean;
  error: string | null;
  fetchPivos: () => Promise<void>;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const useClientePivos = (): UseClientePivosReturn => {
  const token = useAuthStore((state) => state.token);
  const [pivos, setPivos] = useState<Pivo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeRequest = useCallback(
    async (endpoint: string) => {
      if (!token) throw new Error('Não autenticado');

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

  const fetchPivos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await makeRequest('/api/pivos');
      setPivos(data.pivos || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar pivôs';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [makeRequest]);

  return {
    pivos,
    loading,
    error,
    fetchPivos,
  };
};
