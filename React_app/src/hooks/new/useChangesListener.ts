// useChangesListener.ts
// Hook para monitorar mudanças via FastAPI /api/history/changes — sem acesso direto ao CouchDB.

import { useEffect, useRef } from 'react'
import { getChanges } from '../../api/new/fastapi-history'

export interface ChangeEvent<T = any> {
  seq: string | number
  id: string
  changes: Array<{ rev: string }>
  doc?: T
  deleted?: boolean
}

export interface UseChangesListenerOptions {
  /** Callback chamado quando há mudanças */
  onChange: (changes: ChangeEvent[]) => void
  /** Filtro por irrigador específico (opcional) */
  irrigadorId?: string
  /**
   * Intervalo base de polling em ms (padrão: 10000ms).
   * Ignorado quando adaptiveBackoff=true.
   */
  pollInterval?: number
  /** Se deve pausar o listener */
  pause?: boolean
  /** Callback de erro */
  onError?: (error: Error) => void
  /** Usar longpoll ao invés de polling normal */
  useLongpoll?: boolean
  /**
   * Backoff adaptativo interno: sem estado externo, sem re-renders.
   * Começa em 10s; sem mudança ×3 → 20s; ×6 → 30s; mudança → reset a 10s.
   */
  adaptiveBackoff?: boolean
}

export function useChangesListener(options: UseChangesListenerOptions) {
  // Estabiliza callbacks e opções via refs para que `poll` nunca precise ser recriada
  const onChangeRef = useRef(options.onChange)
  const onErrorRef = useRef(options.onError)
  const irrigadorIdRef = useRef(options.irrigadorId)
  const pauseRef = useRef(options.pause ?? false)
  const useLongpollRef = useRef(options.useLongpoll ?? true)
  const adaptiveBackoffRef = useRef(options.adaptiveBackoff ?? false)
  const basePollIntervalRef = useRef(options.pollInterval ?? 10000)

  // Sincroniza refs a cada render sem recriar poll
  onChangeRef.current = options.onChange
  onErrorRef.current = options.onError
  irrigadorIdRef.current = options.irrigadorId
  pauseRef.current = options.pause ?? false
  useLongpollRef.current = options.useLongpoll ?? true
  adaptiveBackoffRef.current = options.adaptiveBackoff ?? false
  basePollIntervalRef.current = options.pollInterval ?? 10000

  const lastSeqRef = useRef<string | number>('now')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPollingRef = useRef(false)
  // Controle interno do backoff — apenas refs, zero re-renders
  const noChangeCountRef = useRef(0)
  const currentIntervalRef = useRef(options.pollInterval ?? 10000)
  const errorCountRef = useRef(0)

  // Reinicia apenas quando pause ou irrigadorId mudam (gatilhos estruturais).
  // onChange, onError e pollInterval são lidos de refs dentro do loop — sem restart.
  const pause = options.pause ?? false
  const irrigadorId = options.irrigadorId

  useEffect(() => {
    if (pause) return

    // Ao trocar de irrigador, recomeça do "now"
    lastSeqRef.current = 'now'
    noChangeCountRef.current = 0
    currentIntervalRef.current = basePollIntervalRef.current

    let cancelled = false

    const poll = async () => {
      if (cancelled || isPollingRef.current) return

      isPollingRef.current = true

      try {
        const useLongpoll = useLongpollRef.current
        const interval = currentIntervalRef.current

        const params: Record<string, any> = {
          since: lastSeqRef.current,
          feed: useLongpoll ? 'longpoll' : 'normal',
          limit: 1000,
          timeout_ms: useLongpoll ? Math.min(interval, 30000) : 5000,
        }

        if (irrigadorId) {
          params.irrigador_id = irrigadorId
        }

        const response = await getChanges(params)
        const data = response.data ?? {}

        const hasResults = data.results && data.results.length > 0

        if (hasResults) {
          lastSeqRef.current = data.last_seq
          onChangeRef.current(data.results as ChangeEvent[])

          // Mudança detectada: reseta backoff
          if (adaptiveBackoffRef.current) {
            noChangeCountRef.current = 0
            currentIntervalRef.current = 10000
            errorCountRef.current = 0
          }
        } else {
          if (data.last_seq) lastSeqRef.current = data.last_seq

          // Sem mudança: aumenta intervalo progressivamente
          if (adaptiveBackoffRef.current) {
            const count = ++noChangeCountRef.current
            if (count === 3) currentIntervalRef.current = 20000
            else if (count >= 6) currentIntervalRef.current = 30000
          }
        }
      } catch (error: any) {
        const isTimeout =
          error?.code === 'ECONNABORTED' ||
          error?.message?.includes('timeout') ||
          error?.code === 'ETIMEDOUT'

        if (!isTimeout) {
          console.error('[useChangesListener] Erro ao buscar mudanças:', error)
          onErrorRef.current?.(error)
        }
        if (adaptiveBackoffRef.current) {
          const errCount = ++errorCountRef.current
          if (errCount === 1) currentIntervalRef.current = 15000
          else if (errCount === 2) currentIntervalRef.current = 30000
          else if (errCount >= 3) currentIntervalRef.current = 60000
        }
      } finally {
        isPollingRef.current = false
        if (!cancelled) {
          timeoutRef.current = setTimeout(poll, currentIntervalRef.current)
        }
      }
    }

    poll()

    return () => {
      cancelled = true
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      isPollingRef.current = false
    }
  }, [pause, irrigadorId]) // eslint-disable-line react-hooks/exhaustive-deps

  return {}
}
