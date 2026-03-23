import { useState, useCallback } from "react";
import { useAuthStore } from "../../stores/new/authStore";
import apiClient from "../../api/new/apiClient";

/**
 * Hook para gerenciar pivôs com verificação de permissão
 * Admin:    lista todos os pivôs
 * Revenda:  lista pivôs dos seus clientes
 * Cliente:  lista seus pivôs
 */
export function usePivos() {
  const authState = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPivos = useCallback(async () => {
    if (!authState.isAuthenticated || !authState.user?.email) {
      setError("Usuário não autenticado");
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get("/pivos");
      return response.data?.pivos || [];
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.detail || err?.message || "Erro ao buscar pivôs";
      setError(errorMsg);
      console.error("usePivos fetchPivos error:", err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [authState.isAuthenticated, authState.user?.email]);

  /**
   * Criar novo pivô
   * - Cliente: envia apenas codigo, nome, equipamentos, location (backend resolve hierarquia)
   * - Admin/Revenda: precisa enviar cliente_id adicionalmente
   */
  const createPivo = useCallback(
    async (pivoData: {
      codigo: string;
      nome: string;
      cliente_id?: string;
      equipamentos?: string[];
      location?: { lat: number; lng: number };
      whatsapp?: string;
      sms?: string;
      email?: string;
    }) => {
      if (!authState.isAuthenticated) {
        throw new Error("Usuário não autenticado");
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post("/pivos", pivoData);
        return response.data;
      } catch (err: any) {
        const errorMsg =
          err?.response?.data?.detail || err?.message || "Erro ao criar pivô";
        setError(errorMsg);
        throw new Error(errorMsg);
      } finally {
        setLoading(false);
      }
    },
    [authState.isAuthenticated],
  );

  const updatePivo = useCallback(
    async (
      pivoId: string,
      pivoData: { nome?: string; ativo?: boolean; location?: any },
    ) => {
      if (!authState.isAuthenticated) {
        throw new Error("Usuário não autenticado");
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.put(`/pivos/${pivoId}`, pivoData);
        return response.data;
      } catch (err: any) {
        const errorMsg =
          err?.response?.data?.detail ||
          err?.message ||
          "Erro ao atualizar pivô";
        setError(errorMsg);
        throw new Error(errorMsg);
      } finally {
        setLoading(false);
      }
    },
    [authState.isAuthenticated],
  );

  const deletePivo = useCallback(
    async (pivoId: string) => {
      if (!authState.isAuthenticated) {
        throw new Error("Usuário não autenticado");
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.delete(`/pivos/${pivoId}`);
        return response.data;
      } catch (err: any) {
        const errorMsg =
          err?.response?.data?.detail || err?.message || "Erro ao deletar pivô";
        setError(errorMsg);
        throw new Error(errorMsg);
      } finally {
        setLoading(false);
      }
    },
    [authState.isAuthenticated],
  );

  return {
    loading,
    error,
    fetchPivos,
    createPivo,
    updatePivo,
    deletePivo,
  };
}
