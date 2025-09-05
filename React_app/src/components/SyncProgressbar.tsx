// components/SyncProgressBar.tsx
import React from 'react';
import { getSyncActiveCount } from '../stores/syncCounterStore';

type Props = {
  /** 0–100 para barra determinada; se omitido ou null, usa indeterminada */
  progress?: number | null;
  /** Texto opcional */
  message?: string;
};

const containerStyle: React.CSSProperties = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 16,
  display: 'flex',
  justifyContent: 'center',
  zIndex: 1000,
  // não intercepta cliques/scroll do app
  pointerEvents: 'none',
};

const shellStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  backgroundColor: 'rgba(25,25,25,0.9)',
  color: 'white',
  padding: '10px 14px',
  borderRadius: 999,
  boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
  border: '1px solid rgba(255,255,255,0.12)',
  backdropFilter: 'blur(6px)',
  pointerEvents: 'none', // permanece não-interativo
};

const trackStyle: React.CSSProperties = {
  width: 320,
  maxWidth: '60vw',
  height: 6,
  borderRadius: 999,
  backgroundColor: 'rgba(255,255,255,0.18)',
  overflow: 'hidden',
};

const barBaseStyle: React.CSSProperties = {
  height: '100%',
  borderRadius: 999,
  backgroundColor: '#4CAF50',
  transition: 'width 160ms ease',
};

const textStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.1,
  fontWeight: 600,
  color: '#EAEAEA',
  whiteSpace: 'nowrap',
  userSelect: 'none',
};

const subTextStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.8,
  marginLeft: 6,
  userSelect: 'none',
};

const SyncProgressBar: React.FC<Props> = ({ progress = null, message = 'Sincronizando…' }) => {
  // Atualiza usando um pequeno polling; se sua store expõe subscribe, prefira-o.
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

  const isDeterminate = progress !== null && progress !== undefined && Number.isFinite(progress);
  const clamped = isDeterminate ? Math.max(0, Math.min(100, Number(progress))) : undefined;

  return (
    <div style={containerStyle} aria-live="polite">
      <style>
        {`
          @keyframes sync-indeterminate {
            0%   { transform: translateX(-60%); }
            50%  { transform: translateX(10%); }
            100% { transform: translateX(120%); }
          }
          @media (prefers-reduced-motion: reduce) {
            .sync-indeterminate { animation: none !important; }
          }
        `}
      </style>

      <div
        style={shellStyle}
        role="progressbar"
        aria-label="Sincronizando banco de dados"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={isDeterminate ? Math.round(clamped!) : undefined}
        aria-busy={true}
      >
        <span style={textStyle}>
          {message}
          <span style={subTextStyle}>
            {syncActiveCount} {syncActiveCount === 1 ? 'tarefa' : 'tarefas'}
          </span>
        </span>

        <div style={trackStyle}>
          {isDeterminate ? (
            <div style={{ ...barBaseStyle, width: `${clamped}%` }} />
          ) : (
            <div
              className="sync-indeterminate"
              style={{
                ...barBaseStyle,
                width: '40%',
                transform: 'translateX(-60%)',
                animation: 'sync-indeterminate 1.4s ease-in-out infinite',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncProgressBar;
