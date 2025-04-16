// pages/DebugPage.jsx
import React, { useState } from 'react';
import dbStore from '../stores/dbStore';
import { useParsedMessages } from '../hooks/useParsedMessages';

const DebugPage = () => {
  const messages = useParsedMessages();
  const [topic, setTopic] = useState('');
  const [payload, setPayload] = useState('');

  const handleAddDocument = async (e) => {
    e.preventDefault();
    const novoDocumento = {
      topic,
      payload,
      origin: "app",
      qos: 0,
    };

    try {
      await dbStore.postData(novoDocumento);
      setTopic('');
      setPayload('');
    } catch (err) {
      console.error("Erro ao salvar documento:", err);
    }
  };

  return (
    <div>
      <h1>Página de Debug do dbStore</h1>
      <form onSubmit={handleAddDocument}>
        <div>
          <label htmlFor="topic">Topic:</label>
          <input
            type="text"
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="payload">Payload:</label>
          <input
            type="text"
            id="payload"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            required
          />
        </div>
        <button type="submit">Adicionar Documento</button>
      </form>

      <h2>Mensagens Parseadas:</h2>
      {messages.length > 0 ? (
        <ul>
          {messages.map((msg, index) => (
            <li key={index}>
              <pre>{JSON.stringify(msg, null, 2)}</pre>
            </li>
          ))}
        </ul>
      ) : (
        <p>Nenhuma mensagem parseada encontrada.</p>
      )}
    </div>
  );
};

export default DebugPage;
