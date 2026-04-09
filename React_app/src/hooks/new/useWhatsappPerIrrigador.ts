/**
 * Hook para gerenciar notificações WhatsApp/SMS por irrigador via FastAPI.
 * Substitui o acesso direto ao documento 'notificacoes:{irrigadorId}' no CouchDB.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  getNotificationsConfig,
  updateNotificationsConfig,
} from '../../api/new/fastapi-history'

export function useWhatsappPerIrrigador(
  irrigadorId: string | null,
  userEmail?: string,
) {
  const [msgEnabled, setMsgEnabled] = useState<boolean>(false)
  const [callEnabled, setCallEnabled] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const fetchConfig = useCallback(async () => {
    if (!irrigadorId || !userEmail) {
      setMsgEnabled(false)
      setCallEnabled(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await getNotificationsConfig(irrigadorId)
      const assinantes = response.data?.assinantes ?? []
      const myConfig = assinantes.find((a: any) => a.email === userEmail)

      if (myConfig) {
        setMsgEnabled(myConfig.msg_enabled)
        setCallEnabled(myConfig.call_enabled)
      } else {
        setMsgEnabled(false)
        setCallEnabled(false)
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setMsgEnabled(false)
        setCallEnabled(false)
      } else {
        console.error('[useWhatsappPerIrrigador] Erro ao buscar:', err)
        setError('Erro ao buscar configuração')
      }
    } finally {
      setLoading(false)
    }
  }, [irrigadorId, userEmail])

  const updateConfig = useCallback(
    async (updates: { msg?: boolean; call?: boolean }) => {
      if (!irrigadorId || !userEmail) return

      setLoading(true)
      setError(null)

      const newMsgState = updates.msg !== undefined ? updates.msg : msgEnabled
      const newCallState = updates.call !== undefined ? updates.call : callEnabled

      try {
        await updateNotificationsConfig(irrigadorId, {
          email: userEmail,
          msg_enabled: newMsgState,
          call_enabled: newCallState,
        })
        setMsgEnabled(newMsgState)
        setCallEnabled(newCallState)
      } catch (err: any) {
        console.error('[useWhatsappPerIrrigador] Erro ao atualizar:', err)
        setError('Erro ao atualizar configuração')
        await fetchConfig()
      } finally {
        setLoading(false)
      }
    },
    [irrigadorId, userEmail, msgEnabled, callEnabled, fetchConfig],
  )

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  return { msgEnabled, callEnabled, loading, error, updateConfig, refresh: fetchConfig }
}
