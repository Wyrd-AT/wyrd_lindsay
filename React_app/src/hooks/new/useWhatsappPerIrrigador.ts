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

import { useState, useEffect, useCallback } from "react";
import { getDoc, upsertDoc } from "../../api/new/couch";

const DB_NAME = "lindsay-data";

interface WhatsappConfig {
  _id: string;
  _rev?: string;
  table: string;
  irrigador_id: string;
  whatsapp_enabled: boolean;
  whatsapp_call_enabled?: boolean; // Novo campo opcional (para retrocompatibilidade)
  updated_at: string;
  updated_by: string;
}

function normalizeNotificationState(msg: boolean, call: boolean) {
  if (call) {
    return { msg: true, call: true };
  }
  if (!msg) {
    return { msg: false, call: false };
  }
  return { msg: true, call: false };
}

export function useWhatsappPerIrrigador(
  irrigadorId: string | null,
  userEmail?: string,
) {
  // const [enabled, setEnabled] = useState<boolean>(true); // Default: ativado
  const [msgEnabled, setMsgEnabled] = useState<boolean>(false); // Padrão msg: desativada
  const [callEnabled, setCallEnabled] = useState<boolean>(false); // Padrão ligação: desativada
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Busca configuração do irrigador
  const fetchConfig = useCallback(async () => {
    if (!irrigadorId) {
      setMsgEnabled(false);
      setCallEnabled(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const docId = `whatsapp_config:${irrigadorId}`;
      const doc = await getDoc<WhatsappConfig>(DB_NAME, docId);

      if (doc) {
        const normalized = normalizeNotificationState(
          doc.whatsapp_enabled ?? false,
          doc.whatsapp_call_enabled ?? false,
        );
        setMsgEnabled(normalized.msg);
        setCallEnabled(normalized.call);
      } else {
        setMsgEnabled(false);
        setCallEnabled(false);
      }
    } catch (err: any) {
      // 404 significa que não existe configuração - usa padrão (desativado)
      if (err?.response?.status === 404 || err?.status === 404) {
        setMsgEnabled(false);
        setCallEnabled(false);
      } else {
        console.error("[useWhatsappPerIrrigador] Error fetching config:", err);
        setError(err?.message || "Erro ao buscar configuração");
        setMsgEnabled(false);
        setCallEnabled(false);
      }
    } finally {
      setLoading(false);
    }
  }, [irrigadorId]);

  // Atualiza configuração
  const updateConfig = useCallback(
    async (updates: { msg?: boolean; call?: boolean }) => {
      if (!irrigadorId) return;

      setLoading(true);
      setError(null);

      const normalizedState = normalizeNotificationState(
        updates.msg !== undefined ? updates.msg : msgEnabled,
        updates.call !== undefined ? updates.call : callEnabled,
      );
      const newMsgState = normalizedState.msg;
      const newCallState = normalizedState.call;

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
          table: "whatsapp_config",
          irrigador_id: irrigadorId,
          whatsapp_enabled: newMsgState,
          whatsapp_call_enabled: newCallState,
          updated_at: now,
          updated_by: userEmail || "Desconhecido",
          ...(existingDoc?._rev ? { _rev: existingDoc._rev } : {}),
        };

        await upsertDoc(DB_NAME, docToSave);
        setMsgEnabled(newMsgState);
        setCallEnabled(newCallState);

        //console.log(`[useWhatsappPerIrrigador] WhatsApp ${newEnabled ? 'ativado' : 'desativado'} para ${irrigadorId}`);
      } catch (err: any) {
        console.error("[useWhatsappPerIrrigador] Error updating config:", err);
        setError(err?.message || "Erro ao atualizar configuração");
        // Reverte estado em caso de erro
        await fetchConfig();
      } finally {
        setLoading(false);
      }
    },
    [irrigadorId, userEmail, msgEnabled, callEnabled, fetchConfig],
  );

  const toggleMsg = useCallback(
    () => updateConfig({ msg: !msgEnabled }),
    [msgEnabled, updateConfig],
  );
  const toggleCall = useCallback(
    () => updateConfig(callEnabled ? { call: false } : { msg: true, call: true }),
    [callEnabled, updateConfig],
  );

  // Carrega configuração ao montar ou quando irrigadorId muda
  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    msgEnabled,
    callEnabled,
    loading,
    error,
    toggleMsg,
    toggleCall,
    refresh: fetchConfig,
  };
}
