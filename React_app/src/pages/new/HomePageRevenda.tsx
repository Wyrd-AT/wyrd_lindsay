// src/pages/HomePageRevenda.jsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";


import BodyContent from "../../components/new/body";
import Header from "../../components/new/header";
import Sidebar from "../../components/new/sidebar";
import IrrigadorCard from "../../components/new/irrigadorCard";
import { ModalIrrigador } from "../../components/new/modalNewIrrigador";

import { useIrrigadores } from "../../stores/new/dataStoreIrrigadores";
import { useAuthStore } from "../../stores/new/authStore";

import { getRecentAll, RecentSWDoc } from '../../hooks/new/getRecent';
import { pingCouch } from "../../api/new/couch";
import { parseSwVector } from "../../helpers/helperHomePage";




export default function HomePageRevenda() {
  const navigate = useNavigate();


  const { isAuthenticated, user } = useAuthStore();
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);


  const email = user?.email ?? '';
  const domainAndTld = email.split('@')[1] ?? '';
  const companyId = domainAndTld.split('.')[0] ?? '';

  const [couchOk, setCouchOk] = useState<boolean | null>(null);


  const irrigadores = useIrrigadores(companyId);
  const irrigadorIds = useMemo(
    () => (Array.isArray(irrigadores) ? irrigadores.map((doc) => String(doc.codigo)) : []),
    [irrigadores]
  );

  const [todosSW, setTodosSW] = useState<Record<string, RecentSWDoc>>({});
  const [loadingSW, setLoadingSW] = useState(false);
  const [errorSW, setErrorSW] = useState<string | null>(null);

  const fetchSW = useCallback(async () => {
    if (!irrigadorIds?.length || couchOk !== true) return;
    setLoadingSW(true);
    setErrorSW(null);
    try {
      const results = await Promise.all(
        irrigadorIds.map(async (id) => {
          const all = await getRecentAll('lindsay-data', id);
          return { id, sw: all.sw || null };
        })
      );
      const map: Record<string, RecentSWDoc> = {};
      for (const r of results) {
        if (!r.sw) continue;
        const prev = map[r.id];
        const currMs = Date.parse(r.sw.updated_at || r.sw.data?.timestamp || '') || 0;
        const prevMs = prev ? (Date.parse(prev.updated_at || prev.data?.timestamp || '') || 0) : -1;
        if (!prev || currMs > prevMs) map[r.id] = r.sw;
      }
      setTodosSW(map);
    } catch (e: any) {
      setErrorSW(e?.message ?? 'Falha ao carregar vetores recentes');
    } finally {
      setLoadingSW(false);
    }
  }, [irrigadorIds, couchOk]);


  const doPing = async () => {
    try {
      setCouchOk(null);
      const res = await pingCouch() as boolean | { ok?: boolean; status?: number };
      const ok = typeof res === 'boolean' ? res : !!(res && (res.ok ?? res?.status === 200));
      setCouchOk(ok);
      if (!ok) {
        setErrorSW('Não foi possível conectar ao servidor (CouchDB).');
      } else {
        await fetchSW();
      }
    } catch {
      setCouchOk(false);
      setErrorSW('Não foi possível conectar ao servidor (CouchDB).');
    }
  };

  useEffect(() => { doPing(); }, [fetchSW]);


  // 2) Redireciona se não estiver logado



  // 4) Estado do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);


  // 7) Funções para abrir e fechar o modal
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  // 8) Função de navegação para a página do irrigador
  const navigateToIrrigador = (id: string) => {
    navigate(`/irrigador/${id}`);
  };

  return (
    <div className="w-full h-full text-white flex bg-[#313131]">

      <Sidebar />
      <BodyContent>
        <Header page="home" />

        <div className="flex items-center justify-between px-4 mb-4">
          <h1 className="text-2xl font-bold">Pivôs</h1>
          <button
            onClick={openModal}
            className="bg-[#08cb7c] p-2 rounded-lg font-bold"
          >
            + Adicionar Pivô
          </button>
        </div>

        <div
          className="w-full flex flex-wrap overflow-auto justify-start 
                     scrollbar scrollbar-thin scrollbar-thumb-red-500 
                     scrollbar-track-gray-800 py-4 gap-4 px-4"
        >
          {irrigadores.length > 0 ? (
            irrigadores.map(doc => {
              const swDoc = todosSW[doc.codigo];
              const info = swDoc ? parseSwVector(swDoc.data, swDoc.updated_at) : { date: "—", totalAlarmado: 0 };

              return (
                <IrrigadorCard
                  key={doc._id}
                  machineId={doc.codigo}
                  displayName={doc.irrigador}
                  alertCount={info.totalAlarmado}
                  lastAlertDate={info.date}
                  onClick={() => navigateToIrrigador(doc.codigo)}
                />
              );
            })
          ) : (
            <div className="text-gray-400">
              Nenhum pivô cadastrado.
            </div>
          )}
        </div>

        {isModalOpen && <ModalIrrigador closeModal={closeModal} />}
      </BodyContent>

    </div>
  );
}
