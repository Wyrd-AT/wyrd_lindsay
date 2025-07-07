// 3) Exemplo de componente React de status de sync
// src/components/SyncStatus.tsx
import React from 'react';
import { useSyncStore } from '../stores/syncStore';

export function SyncStatus() {
  const syncTimestamp = useSyncStore((state) => state.syncTimestamp);
  return (
    <div className="text-xs text-gray-400 mb-2">
      Última sincronização: {new Date(syncTimestamp).toLocaleString()}
    </div>
  );
}