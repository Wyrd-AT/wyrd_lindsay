import { useEffect } from 'react';
import { useAuthStore } from '../../stores/new/authStore';

/**
 * Hook para validar e limpar estado de autenticação inválido
 * 
 * Detecta estados antigos que não têm type/status e limpa automaticamente
 */
export function useAuthStateValidator() {
  useEffect(() => {
    const state = useAuthStore.getState();
    
    // Verificar se o estado está autenticado mas sem type/status (estado antigo)
    if (state.isAuthenticated && state.user && (!state.user.type || !state.user.status)) {
      console.warn('⚠️ Estado de autenticação inválido detectado (sem type/status), limpando...');
      
      // Limpar do sessionStorage
      try {
        sessionStorage.removeItem('auth-storage');
        console.log('✅ Estado antigo removido do sessionStorage');
      } catch (e) {
        console.error('❌ Erro ao limpar sessionStorage:', e);
      }
      
      // Limpar o estado
      useAuthStore.getState().logout();
      console.log('✅ Estado limpo, faça login novamente');
    }
  }, []); // Executa apenas uma vez ao montar
}
