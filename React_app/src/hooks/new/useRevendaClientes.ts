/**
 * Hook para gerenciar clientes de uma revenda
 * Refatorado para utilizar o apiClient (Axios)
 */

import { useCallback, useState } from "react";
import { useAuthStore } from "../../stores/new/authStore";
import type { Cliente } from "../../types/admin";
import apiClient from "../../api/new/apiClient";

interface UseRevendaClientesReturn {
  clientes: Cliente[];
  loading: boolean;
  error: string | null;
  fetchClientes: () => Promise<void>;
}

export const useRevendaClientes = (): UseRevendaClientesReturn => {
  const token = useAuthStore((state) => state.token);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Buscar todos os clientes da revenda
   */
  const fetchClientes = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/clientes");
      setClientes(response.data.clientes || []);
    } catch (err: any) {
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
