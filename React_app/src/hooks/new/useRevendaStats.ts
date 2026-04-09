/**
 * Hook para estatísticas de uma revenda
 * Refatorado para utilizar o apiClient (Axios)
 */

import { useCallback, useState } from "react";
import { useAuthStore } from "../../stores/new/authStore";
import type { RevendaStats } from "../../types/admin";
import apiClient from "../../api/new/apiClient"; // 👈 Ajuste o caminho se necessário

const DEFAULT_STATS: RevendaStats = {
  totalClientes: 0,
  activeClientes: 0,
  pendingClientes: 0,
  totalPivos: 0,
  activePivos: 0,
  alarmadoPivos: 0,
};

export const useRevendaStats = () => {
  const token = useAuthStore((state) => state.token);
  const [stats, setStats] = useState<RevendaStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Buscar todas as estatísticas (Clientes e Pivôs)
   */
  const fetchStats = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      // O prefixo /api já está na baseURL do seu apiClient
      // Realiza as chamadas em paralelo para melhor performance
      const [clientesRes, pivosRes] = await Promise.all([
        apiClient.get("/clientes"),
        apiClient.get("/pivos", { params: { with_recent: true } }),
      ]);

      // No Axios, os dados retornados ficam em .data
      const clientes = clientesRes.data.clientes || [];
      const pivos = pivosRes.data.pivos || [];

      const newStats: RevendaStats = {
        totalClientes: clientes.length,
        activeClientes: clientes.filter((c: any) => c.status === "active")
          .length,
        pendingClientes: clientes.filter((c: any) => c.status === "pending")
          .length,
        totalPivos: pivos.length,
        activePivos: pivos.filter((p: any) => p.ativo === true).length,
        alarmadoPivos: pivos.filter(
          (p: any) => Number(p.alarm_count ?? 0) > 0,
        ).length,
      };

      setStats(newStats);
    } catch (err: any) {
      // Captura a mensagem de erro vinda do backend ou do Axios
      const message =
        err.response?.data?.detail ||
        err.message ||
        "Erro ao buscar estatísticas";
      setError(message);
      console.error("❌ Erro ao buscar estatísticas da revenda:", err);
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
