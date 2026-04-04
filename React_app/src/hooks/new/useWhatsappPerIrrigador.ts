/**
 * Hook para gerenciar notificações WhatsApp/SMS por irrigador usando Tabela de Assinaturas (Pub/Sub)
 */
import { useState, useEffect, useCallback } from "react";
import { getDoc, upsertDoc } from "../../api/new/couch";

const DB_NAME = "lindsay-data";

interface Assinante {
  user_id: string;
  numero: string;
  msg_enabled: boolean;
  call_enabled: boolean;
}

interface NotificacoesDoc {
  _id: string;
  _rev?: string;
  table: string;
  codigo: string;
  assinantes: Assinante[];
  updated_at: string;
}

export function useWhatsappPerIrrigador(
  irrigadorId: string | null,
  userEmail?: string,
) {
  const [msgEnabled, setMsgEnabled] = useState<boolean>(false);
  const [callEnabled, setCallEnabled] = useState<boolean>(false);
  const [savedPhone, setSavedPhone] = useState<string | null>(null); // Guardamos se ele já tem número
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!irrigadorId || !userEmail) {
      setMsgEnabled(false);
      setCallEnabled(false);
      setSavedPhone(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const docId = `notificacoes:${irrigadorId}`;
      const doc = await getDoc<NotificacoesDoc>(DB_NAME, docId);

      if (doc && doc.assinantes) {
        const myConfig = doc.assinantes.find((a) => a.user_id === userEmail);
        if (myConfig) {
          setMsgEnabled(myConfig.msg_enabled);
          setCallEnabled(myConfig.call_enabled);
          setSavedPhone(myConfig.numero);
        } else {
          setMsgEnabled(false);
          setCallEnabled(false);
          setSavedPhone(null);
        }
      }
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.status === 404) {
        setMsgEnabled(false);
        setCallEnabled(false);
        setSavedPhone(null);
      } else {
        console.error("[useWhatsappPerIrrigador] Erro ao buscar:", err);
        setError("Erro ao buscar configuração");
      }
    } finally {
      setLoading(false);
    }
  }, [irrigadorId, userEmail]);

  // Função central de atualização com Retry-on-Conflict (Erro 409)
  const updateConfig = useCallback(
    async (updates: { msg?: boolean; call?: boolean; phone?: string }) => {
      if (!irrigadorId || !userEmail) return;

      setLoading(true);
      setError(null);

      const newMsgState = updates.msg !== undefined ? updates.msg : msgEnabled;
      const newCallState =
        updates.call !== undefined ? updates.call : callEnabled;
      // Se não passar telefone novo, usa o que já estava salvo
      const activePhone = updates.phone || savedPhone || "";

      const docId = `notificacoes:${irrigadorId}`;
      let success = false;
      let retries = 0;
      const MAX_RETRIES = 3;

      while (!success && retries < MAX_RETRIES) {
        try {
          const now = new Date().toISOString();
          let docToSave: NotificacoesDoc;

          try {
            // Puxa a versão mais recente para evitar 409
            const existingDoc = await getDoc<NotificacoesDoc>(DB_NAME, docId);
            let assinantes = [...(existingDoc.assinantes || [])];
            const userIndex = assinantes.findIndex(
              (a) => a.user_id === userEmail,
            );

            if (userIndex >= 0) {
              assinantes[userIndex] = {
                ...assinantes[userIndex],
                numero: activePhone,
                msg_enabled: newMsgState,
                call_enabled: newCallState,
              };
            } else {
              assinantes.push({
                user_id: userEmail,
                numero: activePhone,
                msg_enabled: newMsgState,
                call_enabled: newCallState,
              });
            }

            docToSave = { ...existingDoc, assinantes, updated_at: now };
          } catch (fetchErr: any) {
            if (
              fetchErr?.response?.status === 404 ||
              fetchErr?.status === 404
            ) {
              // Cria a tabela do zero se for o primeiro usuário
              docToSave = {
                _id: docId,
                table: "notificacoes",
                codigo: irrigadorId,
                assinantes: [
                  {
                    user_id: userEmail,
                    numero: activePhone,
                    msg_enabled: newMsgState,
                    call_enabled: newCallState,
                  },
                ],
                updated_at: now,
              };
            } else {
              throw fetchErr;
            }
          }

          await upsertDoc(DB_NAME, docToSave);
          success = true;
          setMsgEnabled(newMsgState);
          setCallEnabled(newCallState);
          setSavedPhone(activePhone); // Atualiza o telefone localmente
        } catch (err: any) {
          if (err?.response?.status === 409 || err?.status === 409) {
            retries++;
            console.warn(`Conflito 409. Retentativa ${retries}...`);
          } else {
            console.error("Erro no updateConfig:", err);
            setError("Erro ao atualizar configuração");
            await fetchConfig();
            break;
          }
        }
      }

      if (!success) {
        setError("O sistema está ocupado. Tente novamente.");
        await fetchConfig();
      }

      setLoading(false);
    },
    [irrigadorId, userEmail, savedPhone, msgEnabled, callEnabled, fetchConfig],
  );

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  return {
    msgEnabled,
    callEnabled,
    savedPhone,
    loading,
    error,
    updateConfig,
    refresh: fetchConfig,
  };
}
