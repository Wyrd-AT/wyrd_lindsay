// src/components/EventoAlarme.jsx
import React from 'react';

export default function EventoAlarme({ eventos }) {
  // eventos é um array de objetos com data/hora, tipo e código
  return (
    <div style={{ marginTop: '1rem' }}>
      <h3>Eventos / Alarmes</h3>
      {eventos.length ? (
        <ul>
          {eventos.map((evento, index) => (
            <li key={index}>
              <strong>{evento.irrigador}</strong>: {evento.data} - {evento.tipo} {evento.codigo}
            </li>
          ))}
        </ul>
      ) : (
        <p>Nenhum evento registrado.</p>
      )}
    </div>
  );
}
