/**
 * Hook para gerenciar revendas (Admin only)
 * Refatorado para utilizar o apiClient (Axios)
 */

import { useCallback, useState } from "react";
import { useAuthStore } from "../../stores/new/authStore";
import type { Revenda } from "../../types/admin";
import apiClient from "../../api/new/apiClient"; // 👈 Ajuste o caminho se necessário

interface UseAdminRevendasReturn {
  allRevendas: Revenda[];
  loading: boolean;
  error: string | null;
  fetchAllRevendas: () => Promise<void>;
}

export const useAdminRevendas = (): UseAdminRevendasReturn => {
  const token = useAuthStore((state) => state.token);
  const [allRevendas, setAllRevendas] = useState<Revenda[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return {
    allRevendas,
    loading,
    error,
    fetchAllRevendas,
  };
};
