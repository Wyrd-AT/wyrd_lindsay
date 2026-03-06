/**
 * Hook de Alertas - Integração FastAPI
 * ====================================
 *
 * Substitui o uso direto de funções de API
 * Gerencia cache, loading state e erros
 *
 * Uso:
 *   const { alerts, loading, error, refreshAlerts } = useAlertsAPI();
 */

import { useState, useEffect, useCallback } from "react";
import { alerts as alertsAPI } from "@/api/new/fastapi-api";

export interface Alert {
  _id: string;
  table: string;
  irrigadorId: string;
  status: string;
  timestamp: string;
  [key: string]: any;
}

interface UseAlertsAPIReturn {
  alerts: Alert[];
  total: number;
  loading: boolean;
  error: string | null;
  refreshAlerts: (irrigadorId?: string, limit?: number) => Promise<void>;
  clearError: () => void;
}

/**
 * Hook para gerenciar alertas da API
 */
export const useAlertsAPI = (): UseAlertsAPIReturn => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshAlerts = useCallback(
    async (irrigadorId?: string, limit = 50) => {
      try {
        setLoading(true);
        setError(null);

        const response = await alertsAPI.listAlerts(irrigadorId, limit);

        setAlerts(response.alerts || []);
        setTotal(response.total || 0);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro desconhecido";
        setError(message);
        console.error("❌ Erro ao carregar alertas:", message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Carregar alertas na montagem
  useEffect(() => {
    refreshAlerts();
  }, [refreshAlerts]);

  return {
    alerts,
    total,
    loading,
    error,
    refreshAlerts,
    clearError,
  };
};

export default useAlertsAPI;
