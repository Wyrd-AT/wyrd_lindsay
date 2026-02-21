/**
 * Hook para gerenciar notificações WhatsApp/SMS por irrigador
 *
 * Estrutura do documento no CouchDB:
 * {
 *   "_id": "whatsapp_config:IRRIGADOR_ID",
 *   "table": "whatsapp_config",
 *   "irrigador_id": "IRRIGADOR_ID",
 *   "whatsapp_enabled": true/false,
 *   "updated_at": "ISO_DATE",
 *   "updated_by": "user@email.com"
 * }
 */

import { useState, useEffect, useCallback } from 'react';
import { getDoc, upsertDoc } from '../../api/new/couch';

const DB_NAME = 'lindsay-data';

interface WhatsappConfig {
  _id: string;
  _rev?: string;
  table: string;
  irrigador_id: string;
  whatsapp_enabled: boolean;
  updated_at: string;
  updated_by: string;
}

export function useWhatsappPerIrrigador(irrigadorId: string | null, userEmail?: string) {
  const [enabled, setEnabled] = useState<boolean>(true); // Default: ativado
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Busca configuração do irrigador
  const fetchConfig = useCallback(async () => {
    if (!irrigadorId) {
      setEnabled(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const docId = `whatsapp_config:${irrigadorId}`;
      const doc = await getDoc<WhatsappConfig>(DB_NAME, docId);

      if (doc) {
        setEnabled(doc.whatsapp_enabled ?? true);
      } else {
        setEnabled(true); // Padrão: ativado se não existir documento
      }
    } catch (err: any) {
      // 404 significa que não existe configuração - usa padrão (ativado)
      if (err?.response?.status === 404 || err?.status === 404) {
        setEnabled(true);
      } else {
        console.error('[useWhatsappPerIrrigador] Error fetching config:', err);
        setError(err?.message || 'Erro ao buscar configuração');
        setEnabled(true); // Em caso de erro, assume ativado
      }
    } finally {
      setLoading(false);
    }
  }, [irrigadorId]);

  // Atualiza configuração
  const updateConfig = useCallback(async (newEnabled: boolean) => {
    if (!irrigadorId) return;

    setLoading(true);
    setError(null);

    try {
      const docId = `whatsapp_config:${irrigadorId}`;
      const now = new Date().toISOString();

      // Busca documento existente
      let existingDoc: WhatsappConfig | null = null;
      try {
        existingDoc = await getDoc<WhatsappConfig>(DB_NAME, docId);
      } catch (err: any) {
        // 404 é esperado se não existir
        if (err?.response?.status !== 404 && err?.status !== 404) {
          throw err;
        }
      }

      const docToSave: WhatsappConfig = {
        _id: docId,
        table: 'whatsapp_config',
        irrigador_id: irrigadorId,
        whatsapp_enabled: newEnabled,
        updated_at: now,
        updated_by: userEmail || 'Desconhecido',
        ...(existingDoc?._rev ? { _rev: existingDoc._rev } : {}),
      };

      await upsertDoc(DB_NAME, docToSave);
      setEnabled(newEnabled);

      //console.log(`[useWhatsappPerIrrigador] WhatsApp ${newEnabled ? 'ativado' : 'desativado'} para ${irrigadorId}`);
    } catch (err: any) {
      console.error('[useWhatsappPerIrrigador] Error updating config:', err);
      setError(err?.message || 'Erro ao atualizar configuração');
      // Reverte estado em caso de erro
      await fetchConfig();
    } finally {
      setLoading(false);
    }
  }, [irrigadorId, userEmail, fetchConfig]);

  // Toggle (alterna entre ativado/desativado)
  const toggle = useCallback(async () => {
    await updateConfig(!enabled);
  }, [enabled, updateConfig]);

  // Carrega configuração ao montar ou quando irrigadorId muda
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    enabled,
    loading,
    error,
    updateConfig,
    toggle,
    refresh: fetchConfig,
  };
}
