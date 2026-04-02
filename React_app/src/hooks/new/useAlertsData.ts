import { useState, useEffect, useCallback, useMemo } from "react";
// FASE 1 - Performance: Added useMemo for expensive transformations
import { getAlertHistory, EventDoc } from "./getHistory";

interface UseAlertsDataOptions {
  irrigadorId?: string;
  pageSize?: number;
  table?: "events" | "alarme" | "evento";
}

export interface AlertItem {
  _id: string;
  _rev?: string;
  irrigadorId: string;
  date: string;
  time: string;
  monitor: string | number;
  alarme: string;
  status: string | number;
  estado: string;
  timestamp: Date;
  description?: string;
  responsible?: string;
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

/**
 * Converte EventDoc do CouchDB para AlertItem
 */
export function convertEventToAlert(doc: EventDoc): AlertItem | null {
  try {
    const timestamp = new Date(doc.timestamp);
    if (!Number.isFinite(timestamp.getTime())) return null;

    // Extrair informações do eventType ou description
    // Formato esperado: "A01" onde A=tipo, 01=monitor
    const eventType = doc.eventType || "";
    const alarme = eventType[0];
    //console.log(" EventType:", doc);
    const monitor = doc.monitor || "";

    return {
      _id: doc._id,
      irrigadorId: doc.irrigadorId,
      date: timestamp.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      time: timestamp.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      monitor,
      alarme,
      estado: doc.estado ?? "",
      status: doc.status ?? "",
      timestamp,
      description: doc.description,
      responsible: doc.responsible,
    };
  } catch (error) {
    console.error("Error converting event to alert:", error);
    return null;
  }
}

export function useAlertsData({
  irrigadorId,
  pageSize = 50,
  table = "events",
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

  // Buscar contagem total uma vez
  useEffect(() => {
    let cancelled = false;

    async function fetchTotal() {
      try {
        ////console.log('Fetching total alerts count for irrigadorId:', irrigadorId);

        // Buscar com limite alto apenas para contar
        const docs = await getAlertHistory("lindsay-data", {
          irrigadorId,
          table,
          sort: "desc",
          limit: 10000,
        });

        if (cancelled) return;

        // Converter e filtrar para obter contagem real
        const converted = docs
          .map(convertEventToAlert)
          .filter((alert): alert is AlertItem => alert !== null);

        ////console.log(`Total alerts: ${converted.length}`);

        if (!cancelled) {
          setTotalAlerts(converted.length);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("Error fetching total count:", err);
        }
      }
    }

    fetchTotal();
    return () => {
      cancelled = true;
    };
  }, [irrigadorId, table, refreshCounter]);

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
        const docs = await getAlertHistory("lindsay-data", {
          irrigadorId,
          table,
          sort: "desc",
          limit: pageSize,
          skip: (currentPage - 1) * pageSize,
        });

        if (cancelled) return;

        // Converter para AlertItem
        const converted = docs
          .map(convertEventToAlert)
          .filter((alert): alert is AlertItem => alert !== null);

        if (!cancelled) {
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
  }, [irrigadorId, table, currentPage, pageSize, refreshCounter, pageCache]);

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
