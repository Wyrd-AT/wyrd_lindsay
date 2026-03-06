/**
 * Hook para gerenciar clientes de uma revenda
 * - Listar clientes da revenda
 * - Listar clientes pendentes
 * - Aprovar cliente
 * - Rejeitar cliente
 */

import { useCallback, useState } from "react";
import { useAuthStore } from "../../stores/new/authStore";
import type { Cliente } from "../../types/admin";

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

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const useRevendaClientes = (): UseRevendaClientesReturn => {
  const token = useAuthStore((state) => state.token);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [pendingClientes, setPendingClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeRequest = useCallback(
    async (endpoint: string, method: string = "GET", body?: any) => {
      if (!token) throw new Error("Não autenticado");

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      return response.json();
    },
    [token],
  );

  const fetchClientes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await makeRequest("/api/clientes");
      setClientes(data.clientes || []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao buscar clientes";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [makeRequest]);

  const fetchPendingClientes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await makeRequest("/api/clientes/pending");
      setPendingClientes(data.clientes || []);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Erro ao buscar clientes pendentes";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [makeRequest]);

  const approveCliente = useCallback(
    async (email: string) => {
      setError(null);
      try {
        await makeRequest(`/api/clientes/${email}/approve`, "POST");
        setPendingClientes((prev) => prev.filter((c) => c.email !== email));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao aprovar cliente";
        setError(message);
        throw err;
      }
    },
    [makeRequest],
  );

  const rejectCliente = useCallback(
    async (email: string) => {
      setError(null);
      try {
        await makeRequest(`/api/clientes/${email}/reject`, "POST");
        setPendingClientes((prev) => prev.filter((c) => c.email !== email));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao rejeitar cliente";
        setError(message);
        throw err;
      }
    },
    [makeRequest],
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
