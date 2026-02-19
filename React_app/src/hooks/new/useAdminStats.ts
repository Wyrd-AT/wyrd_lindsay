/**
 * Hook para estatísticas do sistema (Admin only)
 * - Total de revendas/clientes/pivôs
 * - Revendas/clientes por status
 * - Pivôs por status
 */

import { useCallback, useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/new/authStore';
import type { AdminStats } from '../../types/admin';

interface UseAdminStatsReturn {
  stats: AdminStats | null;
  loading: boolean;
  error: string | null;
  fetchStats: () => Promise<void>;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Estatísticas padrão
const DEFAULT_STATS: AdminStats = {
  totalRevendas: 0,
  activeRevendas: 0,
  pendingRevendas: 0,
  rejectedRevendas: 0,
  totalClientes: 0,
  activeClientes: 0,
  pendingClientes: 0,
  rejectedClientes: 0,
  totalPivos: 0,
  activePivos: 0,
  alarmadoPivos: 0,
  maintenancePivos: 0,
};

export const useAdminStats = (): UseAdminStatsReturn => {
  const token = useAuthStore((state) => state.token);
  const [stats, setStats] = useState<AdminStats | null>(DEFAULT_STATS);
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
   * Buscar estatísticas de revendas
   */
  const fetchRevendasStats = useCallback(async () => {
    try {
      const data = await makeRequest('/api/revendas');
      const revendas = data.revendas || [];

      return {
        total: revendas.length,
        active: revendas.filter((r: any) => r.status === 'active').length,
        pending: revendas.filter((r: any) => r.status === 'pending').length,
        rejected: revendas.filter((r: any) => r.status === 'rejected').length,
      };
    } catch (err) {
      console.warn('⚠️ Erro ao buscar stats de revendas:', err);
      return { total: 0, active: 0, pending: 0, rejected: 0 };
    }
  }, [makeRequest]);

  /**
   * Buscar estatísticas de clientes
   */
  const fetchClientesStats = useCallback(async () => {
    try {
      const data = await makeRequest('/api/clientes');
      const clientes = data.clientes || [];

      return {
        total: clientes.length,
        active: clientes.filter((c: any) => c.status === 'active').length,
        pending: clientes.filter((c: any) => c.status === 'pending').length,
        rejected: clientes.filter((c: any) => c.status === 'rejected').length,
      };
    } catch (err) {
      console.warn('⚠️ Erro ao buscar stats de clientes:', err);
      return { total: 0, active: 0, pending: 0, rejected: 0 };
    }
  }, [makeRequest]);

  /**
   * Buscar estatísticas de pivôs
   */
  const fetchPivosStats = useCallback(async () => {
    try {
      const data = await makeRequest('/api/pivos');
      const pivos = data.pivos || [];

      return {
        total: pivos.length,
        active: pivos.filter((p: any) => p.status === 'active').length,
        alarmed: pivos.filter((p: any) => p.status === 'alarmed').length,
        maintenance: pivos.filter((p: any) => p.status === 'maintenance').length,
      };
    } catch (err) {
      console.warn('⚠️ Erro ao buscar stats de pivôs:', err);
      return { total: 0, active: 0, alarmed: 0, maintenance: 0 };
    }
  }, [makeRequest]);

  /**
   * Buscar todas as estatísticas
   */
  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [revendasStats, clientesStats, pivosStats] = await Promise.all([
        fetchRevendasStats(),
        fetchClientesStats(),
        fetchPivosStats(),
      ]);

      const newStats: AdminStats = {
        totalRevendas: revendasStats.total,
        activeRevendas: revendasStats.active,
        pendingRevendas: revendasStats.pending,
        rejectedRevendas: revendasStats.rejected,
        totalClientes: clientesStats.total,
        activeClientes: clientesStats.active,
        pendingClientes: clientesStats.pending,
        rejectedClientes: clientesStats.rejected,
        totalPivos: pivosStats.total,
        activePivos: pivosStats.active,
        alarmadoPivos: pivosStats.alarmed,
        maintenancePivos: pivosStats.maintenance,
      };

      setStats(newStats);
      console.log('✅ Estatísticas carregadas:', newStats);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar estatísticas';
      setError(message);
      console.error('❌ Erro ao buscar estatísticas:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchRevendasStats, fetchClientesStats, fetchPivosStats]);

  return {
    stats,
    loading,
    error,
    fetchStats,
  };
};
