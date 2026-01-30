// useChangesListener.ts
// Hook para monitorar mudanças do CouchDB em tempo real usando _changes feed

import { useEffect, useRef, useCallback } from 'react';
import { getChanges, ChangesOptions } from '../../api/new/couch';

export interface ChangeEvent<T = any> {
  seq: string | number;
  id: string;
  changes: Array<{ rev: string }>;
  doc?: T;
  deleted?: boolean;
}

export interface UseChangesListenerOptions {
  /** Nome do banco de dados */
  db: string;
  /** Callback chamado quando há mudanças */
  onChange: (changes: ChangeEvent[]) => void;
  /** Filtro opcional (ex: "_view" ou função de filtro) */
  filter?: string;
  /** Intervalo de polling em ms (padrão: 5000ms = 5s) */
  pollInterval?: number;
  /** Se deve incluir documentos completos */
  includeDocs?: boolean;
  /** Se deve pausar o listener */
  pause?: boolean;
  /** Callback de erro */
  onError?: (error: Error) => void;
}

/**
 * Hook que monitora mudanças no CouchDB usando _changes feed com polling normal
 *
 * @example
 * ```tsx
 * useChangesListener({
 *   db: 'lindsay-data',
 *   onChange: (changes) => {
 *     console.log('Mudanças detectadas:', changes);
 *     // Atualizar estado local
 *   },
 *   includeDocs: true,
 *   pollInterval: 5000
 * });
 * ```
 */
export function useChangesListener(options: UseChangesListenerOptions) {
  const {
    db,
    onChange,
    filter,
    pollInterval = 5000,
    includeDocs = true,
    pause = false,
    onError
  } = options;

  const lastSeqRef = useRef<string | number>('now');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  const poll = useCallback(async () => {
    if (pause || isPollingRef.current) return;

    isPollingRef.current = true;

    try {
      const params: ChangesOptions = {
        since: lastSeqRef.current,
        feed: 'normal', // Usa polling normal ao invés de longpoll
        include_docs: includeDocs,
        limit: 1000 // Limita a 1000 mudanças por vez
      };

      if (filter) {
        params.filter = filter;
      }

      const response = await getChanges(db, params, { clientTimeout: 10000 }); // 10s timeout

      if (response.results && response.results.length > 0) {
        // Atualiza o último seq processado
        lastSeqRef.current = response.last_seq;

        // Notifica as mudanças
        onChange(response.results);
      } else {
        // Atualiza o seq mesmo sem mudanças
        if (response.last_seq) {
          lastSeqRef.current = response.last_seq;
        }
      }

    } catch (error: any) {
      // Ignora erros de timeout se não houver mudanças
      const isTimeout = error?.code === 'ECONNABORTED' || error?.message?.includes('timeout');

      if (!isTimeout) {
        console.error('[useChangesListener] Erro ao buscar mudanças:', error);
        if (onError) {
          onError(error);
        }
      }
    } finally {
      // Sempre agenda o próximo poll
      isPollingRef.current = false;
      timeoutRef.current = setTimeout(() => {
        poll();
      }, pollInterval);
    }
  }, [db, filter, includeDocs, pause, pollInterval, onChange, onError]);

  useEffect(() => {
    if (!pause) {
      // Inicia o polling
      poll();
    }

    // Cleanup: cancela timeout pendente
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      isPollingRef.current = false;
    };
  }, [poll, pause]);

  // Retorna função para resetar o seq (útil para forçar re-sync)
  const reset = useCallback(() => {
    lastSeqRef.current = 'now';
  }, []);

  return { reset };
}
