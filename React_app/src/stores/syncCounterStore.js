import { create } from 'zustand';

const useSyncCounterStore = create((set, get) => ({
  syncActiveCount: 0,
  increment: () => set(state => ({ syncActiveCount: state.syncActiveCount + 1 })),
  decrement: () => set(state => ({ syncActiveCount: Math.max(0, state.syncActiveCount - 1) })),
}));

export function getSyncActiveCount() {
  return useSyncCounterStore.getState().syncActiveCount;
}
export function incrementSyncActiveCount() {
  useSyncCounterStore.getState().increment();
}
export function decrementSyncActiveCount() {
  useSyncCounterStore.getState().decrement();
}

export default useSyncCounterStore; 