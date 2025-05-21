// pages/DebugPage.jsx
import React, { useState, useMemo } from 'react';
import dbStore from '../stores/dbStore';
import { useParsedMessages } from '../hooks/useParsedMessages';

const DebugPage = () => {
  const messages = useParsedMessages();
  const [topic, setTopic] = useState('');
  const [payload, setPayload] = useState('');

  // estados do filtro de data
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

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

// 2) useMemo filtrando por data+hora exata
const filteredMessages = useMemo(() => {
  return messages.filter(msg => {
    const msgDate = new Date(msg.timestamp);
    if (startDateFilter) {
      const start = new Date(startDateFilter);
      if (msgDate < start) return false;
    }
    if (endDateFilter) {
      const end = new Date(endDateFilter);
      if (msgDate > end) return false;
    }
    return true;
  });
}, [messages, startDateFilter, endDateFilter]);

  return (
    <div>
      <h1>Página de Debug do dbStore</h1>

      <form onSubmit={handleAddDocument} className="mb-6">
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

    <div className="flex flex-wrap items-end gap-4 mb-6">
      <div>
        <label htmlFor="start-datetime">Início (data + hora):</label>
        <input
          type="datetime-local"
          id="start-datetime"
          value={startDateFilter}
          onChange={e => setStartDateFilter(e.target.value)}
          className="border p-1 rounded"
        />
      </div>
      <div>
        <label htmlFor="end-datetime">Fim (data + hora):</label>
        <input
          type="datetime-local"
          id="end-datetime"
          value={endDateFilter}
          onChange={e => setEndDateFilter(e.target.value)}
          className="border p-1 rounded"
        />
      </div>
      <button
        type="button"
        onClick={() => {
          setStartDateFilter('');
          setEndDateFilter('');
        }}
        className="px-3 py-1 bg-gray-200 rounded"
      >
        Limpar filtro
      </button>
    </div>

      <h2>Mensagens Parseadas:</h2>
      {filteredMessages.length > 0 ? (
        <ul>
          {filteredMessages.map((msg, index) => (
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
