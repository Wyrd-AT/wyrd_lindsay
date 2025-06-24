import React from 'react';
import { getSyncActiveCount } from '../stores/syncCounterStore';

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
  zIndex: 1000,
  pointerEvents: 'auto',
  userSelect: 'none',
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: '#313131',
  padding: '32px 40px',
  borderRadius: '8px',
  minWidth: '300px',
  maxWidth: '500px',
  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
  color: 'white',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  fontSize: '1.2em',
};

const SyncProgressModal: React.FC = () => {
  // Use syncActiveCount from syncCounterStore
  const [syncActiveCount, setSyncActiveCount] = React.useState(getSyncActiveCount());

  React.useEffect(() => {
    const interval = setInterval(() => {
      setSyncActiveCount(getSyncActiveCount());
    }, 200);
    return () => clearInterval(interval);
  }, []);

  if (syncActiveCount === 0) {
    return null;
  }

  return (
    <div style={modalStyle} tabIndex={-1}>
      <div style={modalContentStyle}>
        <h2 style={{ margin: '0 0 15px 0', color: '#4CAF50', fontWeight: 600 }}>
          Sincronizando Banco de Dados...
        </h2>
        <div style={{ marginTop: 16, color: '#ccc', fontSize: '1em' }}>
          Aguarde enquanto os dados são carregados.
        </div>
      </div>
    </div>
  );
};

export default SyncProgressModal; 