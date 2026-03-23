/**
 * Hook para gerenciar revendas (Admin only)
 * Refatorado para utilizar o apiClient (Axios)
 */

import { useCallback, useState } from "react";
import { useAuthStore } from "../../stores/new/authStore";
import type { Revenda } from "../../types/admin";
import apiClient from "../../api/new/apiClient"; // 👈 Ajuste o caminho se necessário

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

export const useAdminRevendas = (): UseAdminRevendasReturn => {
  const token = useAuthStore((state) => state.token);
  const [pendingRevendas, setPendingRevendas] = useState<Revenda[]>([]);
  const [allRevendas, setAllRevendas] = useState<Revenda[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Buscar revendas pendentes
   */
  const fetchPendingRevendas = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      // O prefixo /api já está na baseURL do apiClient
      const response = await apiClient.get("/revendas/pending");
      setPendingRevendas(response.data.revendas || []);
    } catch (err: any) {
      const message =
        err.response?.data?.detail || err.message || "Erro ao buscar revendas";
      setError(message);
      console.error("❌ Erro ao buscar revendas pendentes:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  /**
   * Buscar todas as revendas
   */
  const fetchAllRevendas = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/revendas");
      setAllRevendas(response.data.revendas || []);
    } catch (err: any) {
      const message =
        err.response?.data?.detail || err.message || "Erro ao buscar revendas";
      setError(message);
      console.error("❌ Erro ao buscar todas as revendas:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  /**
   * Aprovar revenda
   */
  const approveRevenda = useCallback(
    async (email: string) => {
      if (!token) return;
      setError(null);
      try {
        await apiClient.post(`/revendas/${email}/approve`);
        setPendingRevendas((prev) => prev.filter((r) => r.email !== email));
      } catch (err: any) {
        const message = err.response?.data?.detail || "Erro ao aprovar revenda";
        setError(message);
        console.error("❌ Erro ao aprovar revenda:", err);
        throw err;
      }
    },
    [token],
  );

  /**
   * Rejeitar revenda
   */
  const rejectRevenda = useCallback(
    async (email: string) => {
      if (!token) return;
      setError(null);
      try {
        await apiClient.post(`/revendas/${email}/reject`);
        setPendingRevendas((prev) => prev.filter((r) => r.email !== email));
      } catch (err: any) {
        const message =
          err.response?.data?.detail || "Erro ao rejeitar revenda";
        setError(message);
        console.error("❌ Erro ao rejeitar revenda:", err);
        throw err;
      }
    },
    [token],
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
