import { useState, useEffect, useCallback } from 'react';
import { getTensaoHistory, TensaoRawDoc } from './getHistory';
import type { Period } from '../../types/tension';

interface UseTensionDataOptions {
  irrigadorId: string;
  period: Period;
  limit?: number;
  equipmentNames: string[];
}

export interface TensionMergedPoint {
  timestamp: Date;
  timestampMs: number;
  values: { [equipmentName: string]: number };
}

interface UseTensionDataResult {
  points: TensionMergedPoint[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Agrega pontos mesclados calculando média de voltagens por grupo
 * @param points Pontos já mesclados (A+B)
 * @param targetPoints Número de pontos desejados (ex: 500)
 * @returns Pontos agregados com média de voltagens
 */
function aggregateMergedPoints(
  points: TensionMergedPoint[],
  targetPoints: number
): TensionMergedPoint[] {
  if (points.length <= targetPoints) {
    return points; // Não precisa agregar
  }

  const groupSize = Math.ceil(points.length / targetPoints);
  const aggregated: TensionMergedPoint[] = [];

  for (let i = 0; i < points.length; i += groupSize) {
    const group = points.slice(i, i + groupSize);
    if (group.length === 0) continue;

    // Usar o timestamp do meio do grupo
    const midIndex = Math.floor(group.length / 2);
    const basePoint = group[midIndex];

    // Calcular média das voltagens para cada equipamento
    const avgValues: Record<string, number> = {};

    // Identificar todos os equipamentos presentes
    const equipmentKeys = new Set<string>();
    group.forEach(point => {
      Object.keys(point.values).forEach(key => equipmentKeys.add(key));
    });

    // Calcular média para cada equipamento
    equipmentKeys.forEach(equipmentKey => {
      const voltages: number[] = [];

      group.forEach(point => {
        const voltage = point.values[equipmentKey];
        if (voltage !== undefined && voltage > 0) {
          voltages.push(voltage);
        }
      });

      if (voltages.length > 0) {
        avgValues[equipmentKey] = voltages.reduce((sum, v) => sum + v, 0) / voltages.length;
      }
    });

    // Criar ponto agregado
    aggregated.push({
      timestamp: basePoint.timestamp,
      timestampMs: basePoint.timestampMs,
      values: avgValues
    });
  }

  //console.log(`📊 Agregação final: ${points.length} pontos -> ${aggregated.length} pontos (grupo de ~${groupSize})`);
  return aggregated;
}

// formata no padrão: 2025-10-31T15:47:23-03:00
function formatWithOffset(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');

  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  const offsetMinutes = -date.getTimezoneOffset(); // minutos a leste do UTC
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const offHours = pad(Math.floor(abs / 60));
  const offMins = pad(abs % 60);

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offHours}:${offMins}`;
}

function getPeriodRange(period: Period) {
  if (period === 'all') return {};

  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);

  switch (period) {
    case 'last24h':
      from.setDate(from.getDate() - 1);
      break;
    case 'last7d':
      from.setDate(from.getDate() - 7);
      break;
    case 'last30d':
      from.setDate(from.getDate() - 30);
      break;
  }
  //console.log('From:', from, 'To:', to);
  return {
    fromISO: formatWithOffset(from),
    toISO: formatWithOffset(to),
  };
}

function convertDoc(
  doc: TensaoRawDoc,
  equipmentNames: string[]
): TensionMergedPoint | null {
  try {
    const timestamp = new Date(doc.timestamp);
    if (!Number.isFinite(timestamp.getTime())) return null;

    const values: Record<string, number> = {};
    const monitores = doc.data?.monitores || {};

    let start = 1;
    let end = 7;

    if (doc.monitor_range) {
      const [a, b] = doc.monitor_range.split('-').map(Number);
      if (a && b) {
        start = a;
        end = b;
      }
    }

    let hasAnyValue = false;
    for (let i = start; i <= end; i++) {
      const key = `monitor_${String(i).padStart(2, '0')}`;
      const entry = monitores[key];

      const voltage =
        entry && typeof entry.voltage === 'number' ? entry.voltage : 0;

      const eqIndex = i - 1;
      const eqName = equipmentNames[eqIndex + 2];

      if (eqName && eqName.trim() !== '' && voltage > 0) {
        values[eqName.trim()] = voltage;
        hasAnyValue = true;
      }
    }

    // Retorna null se não tiver nenhum valor válido
    if (!hasAnyValue) {
      return null;
    }

    return {
      timestamp,
      timestampMs: timestamp.getTime(),
      values,
    };
  } catch {
    return null;
  }
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
        const { fromISO, toISO } = getPeriodRange(period);

        const [docsA, docsB] = await Promise.all([
          getTensaoHistory('lindsay-data', irrigadorId, {
            tipo: 'A',
            fromISO,
            toISO,
            sort: 'asc',
            limit,
          }),
          getTensaoHistory('lindsay-data', irrigadorId, {
            tipo: 'B',
            fromISO,
            toISO,
            sort: 'asc',
            limit,
          }),
        ]);

        if (cancelled) return;

        const convertedA = docsA
          .map((d) => convertDoc(d, equipmentNames))
          .filter((p): p is TensionMergedPoint => p !== null);

        const convertedB = docsB
          .map((d) => convertDoc(d, equipmentNames))
          .filter((p): p is TensionMergedPoint => p !== null);

        //console.log(`Converted A: ${convertedA.length} points from ${docsA.length} docs`);
        //console.log(`Converted B: ${convertedB.length} points from ${docsB.length} docs`);

        const map = new Map<number, TensionMergedPoint>();

        [...convertedA, ...convertedB].forEach((p) => {
          const existing = map.get(p.timestampMs);

          if (!existing) {
            map.set(p.timestampMs, { ...p, values: { ...p.values } });
          } else {
            existing.values = { ...existing.values, ...p.values };
          }
        });

        const merged = [...map.values()].sort(
          (a, b) => a.timestampMs - b.timestampMs
        );

        //console.log(`Final merged points (before aggregation): ${merged.length}`);

        // PASSO 3: Agregar pontos para atingir o limite desejado
        const aggregated = aggregateMergedPoints(merged, limit);

        //console.log('Sample aggregated point:', aggregated[0]);

        if (!cancelled) setPoints(aggregated);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? 'Erro ao carregar dados');
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
