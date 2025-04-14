// Teste.js
import React, { useEffect } from 'react';
import { configureReplication } from '../api/database';
import dbStore from '../stores/dbStore';

const Teste = () => {
  useEffect(() => {
    // Configura os índices e ativa a replicação
    configureReplication();
    
    // Exemplo de salvar dados
    const novoDocumento = {
      _id: 'documento_123', // Para atualização; remova se quiser deixar o PouchDB gerar o _id
      clientId: '123',
      ensaioId: 'ensaio1',
      table: 'tabela1',
      conteudo: 'Teste de conteúdo'
    };

    dbStore.saveData(novoDocumento)
      .then(response => {
        console.log("Documento salvo com sucesso:", response);
        // Após salvar, realiza uma leitura para confirmar
        return dbStore.readData({ selector: { clientId: '123' } });
      })
      .then(docs => {
        console.log("Documentos encontrados:", docs);
      })
      .catch(err => {
        console.error("Erro durante teste:", err);
      });
  }, []);

  return (
    <div>
      <h1>Página de Teste do dbStore</h1>
      <p>Verifique o console para logs de operação.</p>
    </div>
  );
};

export default Teste;
