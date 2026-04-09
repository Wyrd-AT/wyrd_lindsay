// getHistory.ts
// Histórico via FastAPI — sem acesso direto ao CouchDB.

import {
  getTensionHistory,
  getEventsHistory as apiGetEventsHistory,
  getSWHistory as apiGetSWHistory,
  getAlertsHistory,
} from '../../api/new/fastapi-history'

export type SortOrder = 'asc' | 'desc'

export interface PageOpts {
  limit?: number
  skip?: number
  sort?: SortOrder
  fromISO?: string
  toISO?: string
}

export interface TensaoRawDoc {
  _id: string
  table: 'tensao_raw'
  irrigadorId: string
  tipo: 'A' | 'B' | 'C' | 'D'
  timestamp: string
  timestamp_formatted: string
  monitor_range: string
  data: {
    monitores: Record<string, { voltage: number; status: number }>
  }
}

export interface TensionSeriesPoint {
  timestamp: string
  values: Record<string, number>
}

export interface SWRawDoc {
  _id: string
  table: 'sw_raw'
  irrigadorId: string
  timestamp: string
  timestamp_formatted: string
  data: {
    painel_1: number
    painel_2: number
    lampada: number
    sirene: number
    manutencao: number
    monitores: Record<
      string,
      { fim_de_curso_1: number; fim_de_curso_2: number; armadilha: number; status: number }
    >
  }
}

export interface EventDoc {
  armadilha: string
  description: string
  estado: string
  eventType: string
  irrigadorId: string
  monitor: string | number
  responsible: string
  status: string
  table: 'events'
  timestamp: string
  timestamp_formatted: string
  _id: string
  _rev: string
}

/** Histórico de tensão via FastAPI. */
export async function getTensaoHistory(
  irrigadorId: string,
  opts: PageOpts & { tipo?: 'A' | 'B' | 'C' | 'D' | 'both' } = {},
): Promise<TensaoRawDoc[]> {
  const { tipo = 'both', fromISO, toISO, limit = 50000 } = opts

  const response = await getTensionHistory(irrigadorId, {
    tipo,
    start_ts: fromISO,
    end_ts: toISO,
    max_points: Math.min(limit, 10000),
  })

  return (response.data?.points ?? []) as TensaoRawDoc[]
}

/** Série de tensão já processada no backend. */
export async function getTensaoSeries(
  irrigadorId: string,
  opts: PageOpts & { tipo?: 'A' | 'B' | 'C' | 'D' | 'both'; period?: string } = {},
): Promise<TensionSeriesPoint[]> {
  const { tipo = 'both', fromISO, toISO, limit = 1000, period } = opts

  const response = await getTensionHistory(irrigadorId, {
    tipo,
    start_ts: fromISO,
    end_ts: toISO,
    period,
    max_points: Math.min(limit, 10000),
  } as any)

  return (response.data?.series ?? []) as TensionSeriesPoint[]
}

/** Histórico de SW via FastAPI. */
export async function getSWHistory(
  irrigadorId: string,
  opts: PageOpts = {},
): Promise<SWRawDoc[]> {
  const { limit = 200, skip = 0, fromISO, toISO } = opts

  const response = await apiGetSWHistory(irrigadorId, {
    start_ts: fromISO,
    end_ts: toISO,
    skip,
    limit,
  })

  return (response.data?.items ?? []) as SWRawDoc[]
}

type GetEventsHistoryOpts = PageOpts & {
  irrigadorId?: string
  eventType?: string
  monitor?: string
}

/** Histórico de eventos via FastAPI. */
export async function getEventsHistory(
  opts: GetEventsHistoryOpts = {},
): Promise<EventDoc[]> {
  const { limit = 300, skip = 0, fromISO, toISO, irrigadorId, eventType } = opts

  if (!irrigadorId) {
    throw new Error("O parâmetro 'irrigadorId' é obrigatório para esta consulta.")
  }

  const response = await apiGetEventsHistory(irrigadorId, {
    event_type: eventType,
    start_ts: fromISO,
    end_ts: toISO,
    skip,
    limit,
  })

  return (response.data?.items ?? []) as EventDoc[]
}

/** Histórico de alertas via FastAPI. */
export async function getAlertHistory(
  opts: GetEventsHistoryOpts = {},
): Promise<{ items: any[]; total: number }> {
  const { limit = 300, skip = 0, fromISO, toISO, irrigadorId, monitor } = opts

  if (!irrigadorId) {
    throw new Error("O parâmetro 'irrigadorId' é obrigatório para esta consulta.")
  }

  const response = await getAlertsHistory(irrigadorId, {
    start_ts: fromISO,
    end_ts: toISO,
    skip,
    limit,
    ...(monitor !== undefined && { monitor }),
  })

  return {
    items: (response.data?.alerts ?? response.data?.items ?? []) as any[],
    total: (response.data?.total ?? 0) as number,
  }
}
