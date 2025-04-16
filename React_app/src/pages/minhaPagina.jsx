// pages/MinhaPagina.jsx (o caminho pode variar, dependendo da sua estrutura)
import React from 'react';
import { useParsedMessages } from '../hooks/useParsedMessages';

export default function MinhaPagina() {
  const messages = useParsedMessages();

  return (
    <div>
      <h1>Mensagens Processadas</h1>
      {messages.map((msg, index) => {
        if (msg.type === 'mtTension') {
          return <div key={index}>MT Tension: {JSON.stringify(msg)}</div>;
        }
        if (msg.type === 'event') {
          return <div key={index}>Evento: {JSON.stringify(msg)}</div>;
        }
        if (msg.type === 'command') {
          return <div key={index}>Comando: {JSON.stringify(msg)}</div>;
        }
        if (msg.type === 'monitorStatus') {
          return <div key={index}>Monitor Status: {JSON.stringify(msg)}</div>;
        }
        return <div key={index}>Tipo não reconhecido</div>;
      })}
    </div>
  );
}
