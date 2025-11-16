import { useEffect } from 'react';
import { startSyncHandler } from '../api/old/database';
import { incrementSyncActiveCount } from '../stores/old/syncCounterStore';

export default function SyncProvider({ children }) {
  useEffect(() => {
    // Increment sync counter and start sync
    incrementSyncActiveCount();
    const sync = startSyncHandler();

    return () => {
      if (sync && sync.cancel) sync.cancel();
    };
  }, []);

  return children;
} 