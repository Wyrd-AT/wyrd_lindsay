import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Sidebar from '../components/sidebar';
import BodyContent from '../components/body';
import Header from '../components/header';
import SearchBar from '../components/searchbar';
import { useParsedMessages } from '../hooks/useParsedMessages';
import { FaRegImage } from 'react-icons/fa';
import { FiAlertOctagon } from 'react-icons/fi';

function ClientCard({ clientName, email, irrigatorCount }) {
  return (
    <div className="w-[368px] h-[132px] bg-[#39393a] rounded-sm relative flex flex-col p-6">
      {/* badge */}
      <div className="absolute top-4 right-4 bg-[#FF3B30] shadow-md rounded-full px-4 py-1">
        <div className="flex items-center gap-1 text-xs text-black">
          <FiAlertOctagon size={16} /> {irrigatorCount}
        </div>
      </div>
      {/* icon */}
      <div className="flex items-center gap-4 mb-4">
        <div className="w-[96px] h-[96px] bg-white rounded-full flex items-center justify-center">
          <FaRegImage className="text-gray-500" size={35} />
        </div>
        <div className="flex flex-col">
          <h3 className="text-sm font-extrabold uppercase text-white truncate">
            Cliente {clientName}
          </h3>
          <p className="text-xs text-white truncate">{email}</p>
        </div>
      </div>
    </div>
  );
}

export default function ClientesPage() {
  const parsed = useParsedMessages();
  const clientMap = {
    '0':'01','1':'01','2':'23','3':'23',
    '4':'45','5':'45','6':'67','7':'67',
    '8':'89','9':'89','A':'AB','B':'AB',
    'C':'CD','D':'CD','E':'EF','F':'EF'
  };

  // agrupa irrigadores por prefixo de cliente
  const clients = useMemo(() => {
    const ids = Array.from(new Set(parsed.map(m => m.irrigadorId)));
    return ids.reduce((acc, id) => {
      const tag = clientMap[id[0].toUpperCase()] || 'Outros';
      acc[tag] = acc[tag] || [];
      acc[tag].push(id);
      return acc;
    }, {});
  }, [parsed]);

  return (
    <div className="w-full min-h-screen text-white flex bg-[#313131]">
      <Sidebar />
      <BodyContent>
        <Header page="" /> {/* mantém o Olá, Revenda! */}
        <h2 className="text-xl font-semibold mb-4 px-4">Todos os Clientes</h2>
        <div className="flex flex-wrap justify-center gap-8 p-4 overflow-auto max-h-[calc(100vh-200px)]">
          {Object.entries(clients).map(([tag, ids]) => {
            const email = `${tag.toLowerCase()}@exemplo.com`;
            return (
              <Link key={tag} to={`/clientes/${tag}`}>
                <ClientCard
                  clientName={tag}
                  email={email}
                  irrigatorCount={ids.length}
                />
              </Link>
            );
          })}
        </div>
      </BodyContent>
      <SearchBar />
    </div>
  );
}
