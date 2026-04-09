import { useState, useEffect, useCallback } from "react";
import { getTensaoSeries, TensionSeriesPoint } from "./getHistory";
import type { Period } from "../../types/tension";

interface UseTensionDataOptions {
  irrigadorId: string;
  period: Period;
  limit?: number;
  equipmentNames: string[];
}

export interface TensionMergedPoint {
  timestamp: string;
  timestampMs: number;
  values: { [equipmentName: string]: number };
}

interface UseTensionDataResult {
  points: TensionMergedPoint[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}


export function useTensionData({
  irrigadorId,
  period,
  limit = 1000,
  equipmentNames,
}: UseTensionDataOptions): UseTensionDataResult {
  const [points, setPoints] = useState<TensionMergedPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const refresh = useCallback(() => {
    setRefreshCounter((c) => c + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      if (!irrigadorId) return;

      setLoading(true);
      setError(null);

      try {
        const series = await getTensaoSeries(irrigadorId, {
          tipo: "both",
          period,
          limit,
        });

        if (cancelled) return;

        const mapped: TensionMergedPoint[] = (series || [])
          .map((p: TensionSeriesPoint) => {
            const ts = new Date(p.timestamp);
            const ms = Number.isFinite(ts.getTime())
              ? ts.getTime()
              : Date.parse(p.timestamp) || 0;
            return {
              timestamp: p.timestamp,
              timestampMs: ms,
              values: p.values || {},
            };
          })
          .filter((p) => Object.keys(p.values || {}).length > 0);

        if (!cancelled) setPoints(mapped);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Erro ao carregar dados");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [irrigadorId, period, limit, equipmentNames, refreshCounter]);

  return { points, loading, error, refresh };
}
