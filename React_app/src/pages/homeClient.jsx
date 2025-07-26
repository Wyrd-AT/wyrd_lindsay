// src/pages/HomePageRevenda.jsx
import React, { useEffect, useState, useMemo } from "react";
import BodyContent from "../components/body";
import Header from "../components/header";
import Sidebar from "../components/sidebar";
import IrrigadorCard from "../components/irrigadorCard";
import SyncProgressModal from "../components/SyncProgressModal";
import { ModalIrrigador } from "../components/modalNewIrrigador";
import { useIrrigadores } from "../stores/dataStoreIrrigadores";
import useVetorSw, { parseSwVector } from "../hooks/vetorSW";
import { useAuthStore } from "../stores/authStore";
import { useNavigate } from "react-router-dom";

export default function HomePageRevenda() {
  const navigate = useNavigate();

  // 1) Pega estado de auth
  const { isAuthenticated, user } = useAuthStore();

  // 2) Redireciona se não estiver logado
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  // 3) Extrai o companyId do email do usuário
  const domainAndTld = user.email.split('@')[1];
  const companyId = domainAndTld.split('.')[0];

  // 4) Estado do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // 5) Obtendo dados de irrigadores
  const irrigadores = useIrrigadores(companyId);
  const irrigadorIds = useMemo(
    () => irrigadores.map(doc => doc.codigo),
    [irrigadores]
  );

  // 6) Obtendo dados de VetorSW
  const swMap = useVetorSw(irrigadorIds);

  // 7) Funções para abrir e fechar o modal
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  // 8) Função de navegação para a página do irrigador
  const navigateToIrrigador = (id) => {
    navigate(`/irrigador/${id}`);
  };

  return (
    <div className="w-full h-screen text-white flex bg-[#313131]">
      <SyncProgressModal />
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
              const { latestSW } = swMap[doc.codigo] || {};
              const info = latestSW ? parseSwVector(latestSW) : { date: "--", totalAlarmado: 0 };

              return (
                <IrrigadorCard
                  key={doc._id}
                  machineId={doc.codigo}
                  displayName={doc.irrigador}
                  alertCount={info.totalAlarmado}
                  lastAlertDate={info.date}
                  onClick={() => navigateToIrrigador(doc.codigo)} // Adicionando navegação ao clicar
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
