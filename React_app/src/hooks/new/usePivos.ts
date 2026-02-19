import { useState, useCallback } from 'react';
import { useAuthStore } from '../../stores/new/authStore';

/**
 * Hook para gerenciar pivôs com verificação de permissão
 * FASE 2: Filtra automticamente por role do usuário
 *
 * Admin:    lista todos os pivôs
 * Gerente:  lista pivôs dos seus clientes
 * Cliente:  lista seus pivôs
 */
export function usePivos() {
  const authState = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Buscar pivôs com base nas permissões do usuário
   */
  const fetchPivos = useCallback(async () => {
    if (!authState.isAuthenticated || !authState.user?.email) {
      setError('Usuário não autenticado');
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const userRole = authState.user.type;

      // Construir query baseado no role
      let query = { type: 'pivo' };

      if (userRole === 'revenda') {
        // Gerente vê pivôs onde é gerente_id
        query = {
          ...query,
          gerente_id: authState.user.email,
        };
      } else if (userRole === 'cliente') {
        // Cliente vê apenas seus pivôs
        query = {
          ...query,
          owner_id: authState.user.email,
        };
      }
      // Admin vê todos (sem filtro adicional)

      // NOTA: Em produção, chamar API real
      // const response = await api.post('/api/pivos/search', query);
      // return response.data;

      // Por enquanto, retornar vazio (será implementado no backend)
      return [];
    } catch (err: any) {
      const errorMsg = err?.message || 'Erro ao buscar pivôs';
      setError(errorMsg);
      console.error('usePivos error:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [authState.isAuthenticated, authState.user?.email, authState.user?.type]);

  /**
   * Criar novo pivô
   */
  const createPivo = useCallback(
    async (pivoData: { codigo: string; nome: string; location?: any }) => {
      if (!authState.isAuthenticated) {
        throw new Error('Usuário não autenticado');
      }

      if (authState.user?.type !== 'cliente') {
        throw new Error('Apenas clientes podem criar pivôs');
      }

      setLoading(true);
      setError(null);

      try {
        const payload = {
          ...pivoData,
          owner_id: authState.user.email,
          gerente_id: authState.user.gerente_id,
        };

        // NOTA: Em produção, chamar API real
        // const response = await api.post('/api/pivos', payload);
        // return response.data;

        console.log('Criando pivô:', payload);
        return { _id: `pivo:${Math.random()}`, ...payload };
      } catch (err: any) {
        const errorMsg = err?.message || 'Erro ao criar pivô';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [authState.isAuthenticated, authState.user?.email, authState.user?.type]
  );

  /**
   * Atualizar pivô
   */
  const updatePivo = useCallback(
    async (pivoId: string, pivoData: Partial<any>) => {
      if (!authState.isAuthenticated) {
        throw new Error('Usuário não autenticado');
      }

      setLoading(true);
      setError(null);

      try {
        // NOTA: Em produção, chamar API real
        // const response = await api.put(`/api/pivos/${pivoId}`, pivoData);
        // return response.data;

        console.log('Atualizando pivô:', pivoId, pivoData);
        return { _id: pivoId, ...pivoData };
      } catch (err: any) {
        const errorMsg = err?.message || 'Erro ao atualizar pivô';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [authState.isAuthenticated]
  );

  /**
   * Deletar pivô (apenas admin)
   */
  const deletePivo = useCallback(
    async (pivoId: string) => {
      if (!authState.isAuthenticated) {
        throw new Error('Usuário não autenticado');
      }

      if (authState.user?.type !== 'admin') {
        throw new Error('Apenas admin pode deletar pivôs');
      }

      setLoading(true);
      setError(null);

      try {
        // NOTA: Em produção, chamar API real
        // const response = await api.delete(`/api/pivos/${pivoId}`);
        // return response.data;

        console.log('Deletando pivô:', pivoId);
        return true;
      } catch (err: any) {
        const errorMsg = err?.message || 'Erro ao deletar pivô';
        setError(errorMsg);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [authState.isAuthenticated, authState.user?.type]
  );

  return {
    loading,
    error,
    fetchPivos,
    createPivo,
    updatePivo,
    deletePivo,
  };
}
