// getRecent.ts
// Snapshots recentes via FastAPI — sem acesso direto ao CouchDB.

import {
  getRecentAll as apiGetRecentAll,
  getRecentTension,
  getRecentSW as apiGetRecentSW,
} from '../../api/new/fastapi-history'

export interface RecentTensaoDoc {
  _id: string
  table: 'tensao_recente'
  name: 'Tensao'
  type: 'A' | 'B' | 'C' | 'D'
  irrigadorId: string
  monitor_range: string
  updated_at: string
  data: {
    timestamp: string
    monitores: Record<string, { voltage: number; status: number }>
  }
}

export interface RecentSWDoc {
  _id: string
  table: 'sw_recente'
  name: 'Status'
  irrigadorId: string
  updated_at: string
  data: {
    timestamp: string
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

export interface RecentAll {
  tensao: Partial<Record<'A' | 'B' | 'C' | 'D', RecentTensaoDoc | null>>
  sw: RecentSWDoc | null
  overview?: {
    equipamentos?: string[]
    cards?: Array<{
      id: string
      title: string
      statuses: Array<{ label: string; value: string | number }>
    }>
    is_in_maintenance?: boolean
    is_sirene_active?: boolean
    status_sw_at?: string | null
    tensao_at?: string | null
    alarm_count?: number
    last_alert_date?: string | null
  }
}

/** Busca todos os snapshots recentes (A/B/C/D + SW) de um irrigador. */
export async function getRecentAll(irrigadorId: string): Promise<RecentAll> {
  const response = await apiGetRecentAll(irrigadorId)
  const data = response.data ?? {}

  return {
    tensao: (data.tensao ?? {}) as Partial<Record<'A' | 'B' | 'C' | 'D', RecentTensaoDoc | null>>,
    sw: (data.sw ?? null) as RecentSWDoc | null,
    overview: data.overview ?? undefined,
  }
}

/** Busca o snapshot recente de tensão por tipo (A|B|C|D). */
export async function getRecentTensao(
  irrigadorId: string,
  tipo: 'A' | 'B' | 'C' | 'D',
): Promise<RecentTensaoDoc | null> {
  try {
    const response = await getRecentTension(irrigadorId, tipo)
    return response.data as RecentTensaoDoc
  } catch (e: any) {
    if (e?.response?.status === 404) return null
    throw e
  }
}

/** Busca o snapshot recente de SW. */
export async function getRecentSW(irrigadorId: string): Promise<RecentSWDoc | null> {
  try {
    const response = await apiGetRecentSW(irrigadorId)
    return response.data as RecentSWDoc
  } catch (e: any) {
    if (e?.response?.status === 404) return null
    throw e
  }
}
