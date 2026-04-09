/**
 * Hook para estatísticas de um cliente
 * Refatorado para utilizar o apiClient (Axios)
 */

import { useCallback, useState } from "react";
import { useAuthStore } from "../../stores/new/authStore";
import type { ClienteStats } from "../../types/admin";
import apiClient from "../../api/new/apiClient"; // 👈 Ajuste o caminho se necessário

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

  /**
   * Buscar estatísticas de pivôs do cliente
   */
  const fetchStats = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      // O prefixo /api já está definido na baseURL do seu apiClient
      const response = await apiClient.get("/pivos", {
        params: { with_recent: true },
      });

      // No Axios, os dados retornados pelo servidor ficam em .data
      const pivos = response.data.pivos || [];

      const newStats: ClienteStats = {
        totalPivos: pivos.length,
        activePivos: pivos.filter((p: any) => p.ativo === true).length,
        alarmadoPivos: pivos.filter(
          (p: any) => Number(p.alarm_count ?? 0) > 0,
        ).length,
        maintenancePivos: pivos.filter((p: any) => p.status === "maintenance")
          .length,
      };

      setStats(newStats);
    } catch (err: any) {
      // Captura a mensagem detalhada de erro do FastAPI ou do Axios
      const message =
        err.response?.data?.detail ||
        err.message ||
        "Erro ao buscar estatísticas";
      setError(message);
      console.error("❌ Erro ao buscar estatísticas do cliente:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  return {
    stats,
    loading,
    error,
    fetchStats,
  };
};
