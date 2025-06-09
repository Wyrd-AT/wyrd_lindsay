import React, { useEffect, useState } from 'react';
import { useMessageStore } from '../stores/messageStore';

const modalStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: '#313131',
  padding: '20px',
  borderRadius: '8px',
  minWidth: '300px',
  maxWidth: '500px',
  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
  color: 'white'
};

const progressBarStyle: React.CSSProperties = {
  width: '100%',
  height: '20px',
  backgroundColor: '#444444',
  borderRadius: '10px',
  marginTop: '10px',
  overflow: 'hidden'
};

const progressFillStyle = (progress: number): React.CSSProperties => ({
  width: `${progress}%`,
  height: '100%',
  backgroundColor: '#4CAF50',
  transition: 'width 0.3s ease-in-out'
});

const SyncProgressModal: React.FC = () => {
  const store = useMessageStore();
  const syncStatus = store.syncStatus || { isSyncing: false, docCountDiff: 0 };
  const docCountDiff = syncStatus.docCountDiff || 0;
  const [initialCount, setInitialCount] = useState<number | null>(null);

  // Track initial count when sync starts
  useEffect(() => {
    if (docCountDiff > 0 && !initialCount) {
      setInitialCount(docCountDiff);
    } else if (docCountDiff === 0) {
      setInitialCount(null);
    }
  }, [docCountDiff]);

  // Show modal for any sync operation
  if (docCountDiff === 0 && !syncStatus.isSyncing) {
    return null;
  }

  // Calculate progress based on initial count
  const progress = initialCount 
    ? Math.max(0, Math.min(100, ((initialCount - docCountDiff) / initialCount) * 100))
    : 0;

  return (
    <div style={modalStyle}>
      <div style={modalContentStyle}>
        <h2 style={{ margin: '0 0 15px 0', color: '#4CAF50' }}>Sincronizando Banco de Dados</h2>
        <p style={{ margin: '0 0 10px 0', color: '#ccc' }}>
          {syncStatus.isSyncing 
            ? `Sincronizando ${docCountDiff.toLocaleString()} documentos restantes...`
            : 'Preparando sincronização...'}
        </p>
        <div style={progressBarStyle}>
          <div style={progressFillStyle(progress)} />
        </div>
        <p style={{ 
          margin: '10px 0 0 0', 
          fontSize: '0.9em', 
          color: '#ccc',
          textAlign: 'center' 
        }}>
          {progress.toFixed(1)}% concluído
        </p>
      </div>
    </div>
  );
};

export default SyncProgressModal; 