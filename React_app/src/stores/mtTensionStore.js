import { create } from 'zustand';
import { loadTensionData } from '../api/tensionData';  // Função para carregar dados de 'mtTension'

// Store para gerenciar os dados de mtTension
export const useMtTensionStore = create((set, get) => ({
  tensionMessages: [],          // Armazena as mensagens de mtTension
  isLoading: true,              // Controle de carregamento
  error: null,                  // Para capturar erros
  syncStatus: {
    isSyncing: false,
    docCountDiff: 0
  },

  // Inicializar o store com os dados de 'mtTension'
  initialize: async (machineId, startTime, endTime) => {
    try {
      const data = await loadTensionData(machineId, startTime, endTime);
      set({
        tensionMessages: data,  // Armazenando os dados de mtTension
        isLoading: false,       // Carregamento concluído
      });
    } catch (err) {
      set({
        error: err.message,     // Captura de erros de carregamento
        isLoading: false,       // Fim do carregamento
      });
    }
  },

  // Função para carregar dados filtrados de 'mtTension'
  loadTension: async (machineId, startTime, endTime) => {
    try {
      const data = await loadTensionData(machineId, startTime, endTime);
      set({ tensionMessages: data, isLoading: false });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  // Atualizar o status de sincronização
  updateSyncStatus: (status) => {
    set({ syncStatus: status });
    const { isSyncing, docCountDiff } = status;
    set({ isLoading: isSyncing || docCountDiff > 0 });
  },

  // Limpar os dados de 'mtTension'
  clearTensionData: () => {
    set({ tensionMessages: [], error: null });
  }
}));

export default useMtTensionStore;
