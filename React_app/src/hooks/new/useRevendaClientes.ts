/**
 * Hook para gerenciar clientes de uma revenda
 * Refatorado para utilizar o apiClient (Axios)
 */

import { useCallback, useState } from "react";
import { useAuthStore } from "../../stores/new/authStore";
import type { Cliente } from "../../types/admin";
import apiClient from "../../api/new/apiClient"; // 👈 Ajuste o caminho se necessário

interface UseRevendaClientesReturn {
  clientes: Cliente[];
  pendingClientes: Cliente[];
  loading: boolean;
  error: string | null;
  fetchClientes: () => Promise<void>;
  fetchPendingClientes: () => Promise<void>;
  approveCliente: (email: string) => Promise<void>;
  rejectCliente: (email: string) => Promise<void>;
}

export const useRevendaClientes = (): UseRevendaClientesReturn => {
  const token = useAuthStore((state) => state.token);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pendingClientes, setPendingClientes] = useState<Cliente[]>([]);
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
      // O prefixo /api já está na baseURL do seu apiClient
      const response = await apiClient.get("/clientes");
      // No Axios, os dados retornados ficam em .data
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

  /**
   * Buscar clientes pendentes
   */
  const fetchPendingClientes = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/clientes/pending");
      setPendingClientes(response.data.clientes || []);
    } catch (err: any) {
      const message =
        err.response?.data?.detail ||
        err.message ||
        "Erro ao buscar clientes pendentes";
      setError(message);
      console.error("❌ Erro ao buscar clientes pendentes:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  /**
   * Aprovar cliente
   */
  const approveCliente = useCallback(
    async (email: string) => {
      if (!token) return;
      setError(null);
      try {
        await apiClient.post(`/clientes/${email}/approve`);
        setPendingClientes((prev) => prev.filter((c) => c.email !== email));
      } catch (err: any) {
        const message = err.response?.data?.detail || "Erro ao aprovar cliente";
        setError(message);
        console.error("❌ Erro ao aprovar cliente:", err);
        throw err;
      }
    },
    [token],
  );

  /**
   * Rejeitar cliente
   */
  const rejectCliente = useCallback(
    async (email: string) => {
      if (!token) return;
      setError(null);
      try {
        await apiClient.post(`/clientes/${email}/reject`);
        setPendingClientes((prev) => prev.filter((c) => c.email !== email));
      } catch (err: any) {
        const message =
          err.response?.data?.detail || "Erro ao rejeitar cliente";
        setError(message);
        console.error("❌ Erro ao rejeitar cliente:", err);
        throw err;
      }
    },
    [token],
  );

  return {
    clientes,
    pendingClientes,
    loading,
    error,
    fetchClientes,
    fetchPendingClientes,
    approveCliente,
    rejectCliente,
  };
};
