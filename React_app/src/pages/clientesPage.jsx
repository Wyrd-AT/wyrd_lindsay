// pages/ClientesPage.jsx
import React, { useMemo } from 'react';
import Sidebar from '../components/sidebar';
import BodyContent from '../components/body';
import Header from '../components/header';
import SearchBar from '../components/searchbar';
import { useParsedMessages } from '../hooks/useParsedMessages';
import { FaRegImage } from 'react-icons/fa';
import { FiAlertOctagon } from 'react-icons/fi';

// Card de cliente no formato Figma (368x132)
function ClientCard({ clientName, email, alertCount }) {
  return (
    <div className="w-[368px] h-[132px] bg-[#39393a] rounded-sm relative flex">
      {/* Badge de alertas */}
      <div className="absolute top-4 right-4 bg-[#FF3B30] shadow-md rounded-full px-4 py-1">
        <div className="flex items-center gap-1 text-xs text-black">
          <FiAlertOctagon size={16} /> {alertCount}
        </div>
      </div>

      {/* Ícone circular */}
      <div className="flex-shrink-0 w-[96px] h-[96px] bg-white rounded-full m-4 flex items-center justify-center">
        <FaRegImage className="text-gray-500" size={35} />
      </div>

      {/* Conteúdo texto */}
      <div className="flex flex-col ml-4 m-5">
        <div className="text-xs font-extrabold uppercase text-white truncate">
          Cliente Fulano {clientName}
        </div>
        <div className="text-xs font-normal text-white truncate">
          {email}
        </div>
      </div>
    </div>
  );
}

export default function ClientesPage() {
  const parsed = useParsedMessages();

  // Mapeamento de prefixos para clientes
  const clientMap = {
    '0': '01','1': '01',
    '2': '23','3': '23',
    '4': '45','5': '45',
    '6': '67','7': '67',
    '8': '89','9': '89',
    'A': 'AB','B': 'AB',
    'C': 'CD','D': 'CD',
    'E': 'EF','F': 'EF'
  };

  // Agrupa irrigadores por cliente
  const clients = useMemo(() => {
    const ids = Array.from(new Set(parsed.map(m => m.irrigadorId)));
    return ids.reduce((acc, id) => {
      const prefix = id.charAt(0).toUpperCase();
      const tag = clientMap[prefix] || 'Outros';
      acc[tag] = acc[tag] || [];
      acc[tag].push(id);
      return acc;
    }, {});
  }, [parsed]);

  return (
    <div className="w-full h-screen text-white flex bg-[#313131]">
      <Sidebar />
      <BodyContent>
        <Header page="clientes" />
        <div className="
          flex flex-wrap p-4 gap-x-24 gap-y-10 justify-center
          max-h-[80vh] overflow-auto
          scrollbar scrollbar-thin scrollbar-thumb-red-500 scrollbar-track-gray-800
        ">
          {Object.entries(clients).map(([tag, ids]) => {
            const clientName = tag;
            const email = `fulano${tag.toLowerCase()}@email.com`;
            return (
              <ClientCard
                key={tag}
                clientName={clientName}
                email={email}
                alertCount={ids.length}
              />
            );
          })}
        </div>
      </BodyContent>
      <SearchBar />
    </div>
  );
}