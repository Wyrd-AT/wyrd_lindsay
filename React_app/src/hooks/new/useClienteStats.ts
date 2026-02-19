/**
 * Hook para estatísticas de um cliente
 * - Total de pivôs
 * - Pivôs por status
 */

import { useCallback, useState } from 'react';
import { useAuthStore } from '../../stores/new/authStore';
import type { ClienteStats } from '../../types/admin';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const DEFAULT_STATS: ClienteStats = {
  totalPivos: 0,
  activePivos: 0,
  alarmadoPivos: 0,
  maintenancePivos: 0,
};

export const useClienteStats = () => {
  const token = useAuthStore((state) => state.token);
  const [stats, setStats] = useState<ClienteStats>(DEFAULT_STATS);
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

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await makeRequest('/api/pivos');
      const pivos = data.pivos || [];

      const newStats: ClienteStats = {
        totalPivos: pivos.length,
        activePivos: pivos.filter((p: any) => p.status === 'active').length,
        alarmadoPivos: pivos.filter((p: any) => p.status === 'alarmed').length,
        maintenancePivos: pivos.filter((p: any) => p.status === 'maintenance').length,
      };

      setStats(newStats);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar estatísticas';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [makeRequest]);

  return {
    stats,
    loading,
    error,
    fetchStats,
  };
};
