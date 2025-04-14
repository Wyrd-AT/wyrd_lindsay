// src/pages/Irrigador.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import TabelaTensao from '../components/tabelaTensao';
import EventoAlarme from '../components/eventoAlarme';
import CommandForm from '../components/commandForm';
import dbStore from '../stores/dbStore';

// Função para parsear os dados dos documentos, identificando medições de tensão e eventos
function parseIrrigadorData(docs, irrigadorTopic) {
  const tensoes = []; // armazenará objetos com dados de tensão
  const eventos = []; // armazenará objetos de evento/alarmes

  docs.forEach((doc) => {
    if (doc.topic === irrigadorTopic) {
      const payload = doc.payload;
      // Caso a payload contenha vírgula e ponto e vírgula, assume que é medição de tensão
      if (payload.includes(',') && payload.includes(';')) {
        // Exemplo: "002,350;451,091;999,121"
        const valores = payload.split(';').map(val => val.trim());
        tensoes.push({ valores });
      } 
      // Se a payload tiver formato de data (ex.: "2025-04-07 22:03;AXXXX"), trata como evento
      else if (/\d{4}-\d{2}-\d{2}/.test(payload)) {
        const partes = payload.split(';').map(p => p.trim());
        eventos.push({
          data: partes[0],
          tipo: partes[1]?.charAt(0) || '',
          codigo: partes[1]?.slice(1) || ''
        });
      }
    }
  });

  return { tensoes, eventos };
}

export default function Irrigador() {
  const { id } = useParams(); // 'id' corresponde ao tópico do irrigador
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ tensoes: [], eventos: [] });

  // Função para obter os documentos da DB usando dbStore
  async function fetchDocs() {
    setLoading(true);
    try {
      // Aqui usamos uma consulta simples que pega todos os documentos.
      const result = await dbStore.readData({ selector: {} });
      setDocs(result);
    } catch (error) {
      console.error("Erro ao buscar documentos:", error);
    } finally {
      setLoading(false);
    }
  }

  // Atualiza os dados sempre que os documentos ou o tópico mudarem
  useEffect(() => {
    async function fetchData() {
      await fetchDocs();
      // Filtra os documentos para o tópico específico e faz o parsing dos dados
      const filteredDocs = docs.filter(doc => doc.topic === id);
      const parsedData = parseIrrigadorData(filteredDocs, id);
      setData(parsedData);
    }
    fetchData();
    // A dependência "docs" garante que, ao atualizar os documentos, o parsing seja refeito
  }, [id, docs]);

  // Função para tratar o envio de comandos
  const handleCommandSubmit = async (irrigadorTopic, command) => {
    console.log(`handleCommandSubmit para ${irrigadorTopic} com comando "${command}"`);
    // Cria um novo documento com os dados do comando
    const newDoc = {
      _id: new Date().toISOString(),
      topic: irrigadorTopic,
      payload: command,
    };
    try {
      await dbStore.saveData(newDoc);
      console.log(`Comando "${command}" salvo na DB para o tópico ${irrigadorTopic}.`);
      // Atualiza os documentos após salvar o comando
      await fetchDocs();
    } catch (error) {
      console.error('Erro ao salvar comando no DB:', error);
    }
  };

  if (loading) {
    return <p>Carregando...</p>;
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Detalhes do Irrigador {id}</h1>
      
      <section>
        <h2>Tensão dos MTs</h2>
        {data.tensoes.length > 0 ? (
          <TabelaTensao mts={data.tensoes} />
        ) : (
          <p>Nenhum dado de tensão disponível.</p>
        )}
      </section>
      
      <section>
        <EventoAlarme eventos={data.eventos} />
      </section>
      
      <section>
        <CommandForm irrigadorId={id} onCommandSubmit={handleCommandSubmit} />
      </section>
    </div>
  );
}
