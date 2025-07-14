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

export default function HomePageRevenda() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const irrigadores = useIrrigadores();

  const irrigadorIds = useMemo(
    () => irrigadores.map(doc => doc.codigo),
    [irrigadores]
  );
  ////console.log(irrigadorIds)

  // { [id]: { vectorsSW: string[], latestSW: string|null } }
  const swMap = useVetorSw(irrigadorIds);
  ////console.log(swMap)
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  return (
    <div className="w-full h-screen text-white flex bg-[#313131]">
      <SyncProgressModal />
      <Sidebar />
      <BodyContent>
        <Header page="home" />

        <div className="flex items-center justify-between px-4 mb-4">
          <h1 className="text-2xl font-bold">Irrigadores</h1>
          <button
            onClick={openModal}
            className="bg-[#08cb7c] p-2 rounded-lg font-bold"
          >
            + Adicionar Irrigador
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
              // parseia o vetor mais recente (ou exibe zeros caso não exista)
              const info = latestSW ? parseSwVector(latestSW) : {
                date: "--",
                totalAlarmado: 0
              };

              return (
                <IrrigadorCard
                  key={doc._id}
                  machineId={doc.codigo}
                  displayName={doc.irrigador}
                  alertCount={info.totalAlarmado}
                  lastAlertDate={info.date}
                />
              );
            })
          ) : (
            <div className="text-gray-400">
              Nenhum irrigador cadastrado.
            </div>
          )}
        </div>

        {isModalOpen && <ModalIrrigador closeModal={closeModal} />}
      </BodyContent>
    </div>
  );
}
