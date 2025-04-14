// pages/testedb.jsx
import React, { useEffect, useState } from 'react';
import dbStore from '../stores/dbStore';

const Teste = () => {
  const [docs, setDocs] = useState([]);
  const [topic, setTopic] = useState('');
  const [payload, setPayload] = useState('');

  // Função para atualizar os dados usando fetchData do dbStore
  const updateData = async () => {
    try {
      const data = await dbStore.fetchData();
      console.log("Documentos atualizados:", data);
      setDocs(data);
    } catch (err) {
      console.error("Erro ao carregar documentos:", err);
    }
  };

  useEffect(() => {
    // Leitura inicial dos dados
    updateData();

    // Configura o listener do changes feed para atualização em "tempo real"
    const changes = dbStore.localDB.changes({
      since: 'now',
      live: true,
      include_docs: true
    })
      .on('change', () => {
        updateData();
      })
      .on('error', (err) => console.error("Erro no listener de mudanças:", err));

    // Cancela o listener ao desmontar o componente
    return () => changes.cancel();
  }, []);

  const handleAddDocument = async (e) => {
    e.preventDefault();
    const novoDocumento = {
      topic,
      payload,
      origin: "app",
      qos: 0
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
      <h1>Página de Teste do dbStore</h1>
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

      <h2>Documentos:</h2>
      {docs.length > 0 ? (
        <ul>
          {docs.map(doc => (
            <li key={doc._id}>
              <strong>ID:</strong> {doc._id} <br />
              <strong>Topic:</strong> {doc.topic} <br />
              <strong>Payload:</strong> {doc.payload}
            </li>
          ))}
        </ul>
      ) : (
        <p>Nenhum documento encontrado.</p>
      )}
    </div>
  );
};

export default Teste;
