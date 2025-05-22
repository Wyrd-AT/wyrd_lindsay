// 1) src/stores/syncStore.js
import { create } from 'zustand'; // import nomeado

// Store reativo para controle de sincronização
export const useSyncStore = create((set) => ({
  syncTimestamp: Date.now(),
  updateSyncTimestamp: () => set({ syncTimestamp: Date.now() }),
}));