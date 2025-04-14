// Exemplo de uso no testedb.tsx com postData

import React, { useEffect, useState } from 'react';
import dbStore from '../stores/dbStore';

const Teste = () => {
  const [docs, setDocs] = useState([]);
  const [topic, setTopic] = useState('');
  const [payload, setPayload] = useState('');

  useEffect(() => {
    // Leitura inicial dos documentos
    dbStore.readData({ selector: {} })
      .then(data => {
        console.log("Documentos carregados:", data);
        setDocs(data);
      })
      .catch(err => console.error("Erro ao carregar documentos:", err));
  }, []);

  // Função para adicionar um novo documento utilizando postData
  const handleAddDocument = (e) => {
    e.preventDefault();
    
    // Cria o documento sem definir o _id (será gerado automaticamente)
    const novoDocumento = {
      topic,
      payload,
      qos: 0
    };

    dbStore.postData(novoDocumento)
      .then(response => {
        console.log("Documento salvo com sucesso:", response);
        // Atualiza a lista de documentos após inserir
        return dbStore.readData({ selector: {} });
      })
      .then(data => {
        console.log("Documentos atualizados:", data);
        setDocs(data);
        setTopic('');
        setPayload('');
      })
      .catch(err => console.error("Erro durante a operação:", err));
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
