import { useState, useEffect, useCallback, useMemo } from "react";
// FASE 1 - Performance: Added useMemo for expensive transformations
import { getAlertHistory } from "./getHistory";

interface UseAlertsDataOptions {
  irrigadorId?: string;
  pageSize?: number;
  table?: "events" | "alarme" | "evento";
  monitor?: string;
}

export interface AlertItem {
  _id: string;
  irrigadorId: string;
  date: string;
  time: string;
  monitor: string | number;
  monitor_name?: string;
  alarme: string;
  status: string | number;
  estado: string;
  timestamp: string;
  description?: string;
  responsible?: string;
  scheduled_for?: string;
  ultimo_agendamento?: string;
  responsavel_agendamento?: string;
  timer_value?: number | string;
  data_solucao?: string;
  responsavel_solucao?: string;
}

interface UseAlertsDataResult {
  alerts: AlertItem[];
  loading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  totalAlerts: number;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  refresh: () => void;
}

const normalizeAlert = (doc: any): AlertItem | null => {
  if (!doc) return null;
  return {
    _id: doc._id || doc.id || "",
    irrigadorId: doc.irrigadorId || "",
    date: doc.date || "",
    time: doc.time || "",
    monitor: doc.monitor ?? "",
    monitor_name: doc.monitor_name,
    alarme: doc.alarme || "",
    estado: doc.estado ?? "",
    status: doc.status ?? "",
    timestamp: doc.timestamp || "",
    description: doc.description,
    responsible: doc.responsible,
    scheduled_for: doc.scheduled_for,
    ultimo_agendamento: doc.ultimo_agendamento,
    responsavel_agendamento: doc.responsavel_agendamento,
    timer_value: doc.timer_value,
    data_solucao: doc.data_solucao,
    responsavel_solucao: doc.responsavel_solucao,
  };
};

export function useAlertsData({
  irrigadorId,
  pageSize = 50,
  table = "events",
  monitor,
}: UseAlertsDataOptions = {}): UseAlertsDataResult {
  const [pageCache, setPageCache] = useState<Map<number, AlertItem[]>>(
    new Map(),
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const refresh = useCallback(() => {
    setPageCache(new Map()); // Limpar cache ao atualizar
    setRefreshCounter((c) => c + 1);
    setCurrentPage(1);
  }, []);

  // Buscar página atual sob demanda
  useEffect(() => {
    let cancelled = false;

    // Se já temos essa página no cache, não buscar novamente
    if (pageCache.has(currentPage)) {
      //console.log(`Page ${currentPage} loaded from cache`);
      return;
    }

    async function fetchPage() {
      setLoading(true);
      setError(null);

      try {
        ////console.log(`Fetching page ${currentPage} (skip: ${(currentPage - 1) * pageSize}, limit: ${pageSize})`);

        // Buscar APENAS a página atual
        const { items, total } = await getAlertHistory({
          irrigadorId,
          sort: "desc",
          limit: pageSize,
          skip: (currentPage - 1) * pageSize,
          ...(monitor !== undefined && { monitor }),
        });

        if (cancelled) return;

        // Converter para AlertItem
        const converted = items
          .map(normalizeAlert)
          .filter((alert): alert is AlertItem => alert !== null);

        if (!cancelled) {
          setTotalAlerts(total);
          // Adicionar ao cache
          setPageCache((prev) => {
            const newCache = new Map(prev);
            newCache.set(currentPage, converted);
            return newCache;
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("Error fetching alerts:", err);
          setError(err?.message ?? "Erro ao carregar alertas");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchPage();
    return () => {
      cancelled = true;
    };
  }, [irrigadorId, table, monitor, currentPage, pageSize, refreshCounter, pageCache]);

  // FASE 1 - Performance: Memoize cache lookup and pagination calculations
  const alerts = useMemo(
    () => pageCache.get(currentPage) || [],
    [pageCache, currentPage],
  );

  const totalPages = useMemo(
    () => Math.ceil(totalAlerts / pageSize),
    [totalAlerts, pageSize],
  );

  const goToPage = useCallback(
    (page: number) => {
      const validPage = Math.max(1, Math.min(page, totalPages));
      setCurrentPage(validPage);
    },
    [totalPages],
  );

  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [currentPage, totalPages]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  }, [currentPage]);

  return {
    alerts,
    loading,
    error,
    currentPage,
    totalPages,
    totalAlerts,
    goToPage,
    nextPage,
    prevPage,
    refresh,
  };
}
