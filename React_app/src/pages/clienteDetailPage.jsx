// src/pages/ClienteDetailPage.jsx
import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import Sidebar from '../components/sidebar';
import BodyContent from '../components/body';
import Header from '../components/header';
import SearchBar from '../components/searchbar';
import { useParsedMessages } from '../hooks/useParsedMessages';
import IrrigadorCard from '../components/irrigadorCard';
import { FiChevronLeft } from 'react-icons/fi';

export default function ClienteDetailPage() {
  const { clientTag } = useParams();
  const parsed = useParsedMessages();

  const clientMap = {
    '01': ['0','1'], '23': ['2','3'],
    '45': ['4','5'], '67': ['6','7'],
    '89': ['8','9'], EF: ['A','B','C','D','E','F']
  };

  const machines = useMemo(() => {
    const prefixes = clientMap[clientTag] || [];
    return Array.from(new Set(parsed.map(m => m.irrigadorId)))
      .filter(id => prefixes.includes(id[0].toUpperCase()));
  }, [parsed, clientTag]);

  const getLastDate = id => {
    const evs = parsed
      .filter(m => m.type === 'event' && m.irrigadorId === id)
      .sort((a,b) => new Date(b.datetime) - new Date(a.datetime));
    return evs.length
      ? new Date(evs[0].datetime).toLocaleDateString()
      : null;
  };
  const getCount = id =>
    parsed.filter(m => m.type === 'event' && m.irrigadorId === id).length;

  return (
    <div className="w-full min-h-screen text-white flex bg-[#313131]">
      <Sidebar />
      <BodyContent>
        <div className="flex items-center gap-3 mb-4">
          <Link to="/clientes" className="text-white hover:text-gray-300">
            <FiChevronLeft size={20} /> Clientes
          </Link>
        </div>

        <Header page="" />

        <h2 className="text-xl font-semibold mb-4 px-4">
          Irrigadores do Cliente {clientTag}
        </h2>

        <div className="
          flex flex-wrap p-4 justify-center gap-6
          overflow-auto max-h-[calc(100vh-200px)]
        ">
          {machines.map(id => (
            <IrrigadorCard
              key={id}
              machineId={id}
              lastAlertDate={getLastDate(id)}
              alertCount={getCount(id)}
              to={`/clientes/${clientTag}/maquina/${id}`}  // <— passa o destino
            />
          ))}
        </div>
      </BodyContent>
      <SearchBar />
    </div>
  );
}
