/**
 * Hook para gerenciar pivôs de um cliente
 * Refatorado para utilizar o apiClient (Axios)
 */

import { useCallback, useState } from "react";
import { useAuthStore } from "../../stores/new/authStore";
import type { Pivo } from "../../types/admin";
import apiClient from "../../api/new/apiClient"; // 👈 Ajuste o caminho conforme sua estrutura de pastas

interface UseClientePivosReturn {
  pivos: Pivo[];
  loading: boolean;
  error: string | null;
  fetchPivos: () => Promise<void>;
}

export const useClientePivos = (): UseClientePivosReturn => {
  const token = useAuthStore((state) => state.token);
  const [pivos, setPivos] = useState<Pivo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Buscar todos os pivôs
   */
  const fetchPivos = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      // O prefixo /api já está incluído na baseURL do seu apiClient
      const response = await apiClient.get("/pivos", {
        params: { with_recent: true },
      });

      // No Axios, os dados retornados pelo backend ficam em .data
      setPivos(response.data.pivos || []);
    } catch (err: any) {
      // Captura o erro detalhado enviado pelo FastAPI
      const message =
        err.response?.data?.detail || err.message || "Erro ao buscar pivôs";
      setError(message);
      console.error("❌ Erro ao buscar pivôs:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  return {
    pivos,
    loading,
    error,
    fetchPivos,
  };
};
