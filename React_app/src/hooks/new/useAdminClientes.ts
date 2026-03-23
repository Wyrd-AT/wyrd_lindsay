/**
 * Hook para gerenciar clientes (Admin view)
 * Refatorado para utilizar o apiClient (Axios)
 */

import { useCallback, useState } from "react";
import { useAuthStore } from "../../stores/new/authStore";
import type { Cliente } from "../../types/admin";
import apiClient from "../../api/new/apiClient"; // 👈 Ajuste o caminho se necessário

interface UseAdminClientesReturn {
  clientes: Cliente[];
  loading: boolean;
  error: string | null;
  fetchClientes: () => Promise<void>;
}

export const useAdminClientes = (): UseAdminClientesReturn => {
  const token = useAuthStore((state) => state.token);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Buscar todos os clientes
   */
  const fetchClientes = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      // O prefixo /api já está definido na baseURL do seu apiClient
      const response = await apiClient.get("/clientes");

      // No Axios, os dados da resposta ficam em .data
      setClientes(response.data.clientes || []);
    } catch (err: any) {
      // Captura a mensagem de erro detalhada vinda da API (FastAPI)
      const message =
        err.response?.data?.detail || err.message || "Erro ao buscar clientes";
      setError(message);
      console.error("❌ Erro ao buscar clientes:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  return {
    clientes,
    loading,
    error,
    fetchClientes,
  };
};
