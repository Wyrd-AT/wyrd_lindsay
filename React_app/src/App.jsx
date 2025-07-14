// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import SyncProvider from "./components/SyncProvider";
import SyncProgressModal from "./components/SyncProgressModal";

import Login from "./pages/login";
import HomePageRevenda from "./pages/homeClient";
import Maquina from "./pages/machine";
import ResetPass from "./pages/resetPass";
import DebugPage from "./pages/testedb";
import ClientMachinesPage from "./pages/clientMachinesPage";
import MaquinaRevenda from "./pages/machineRevenda";
import TensionGraphPage from "./pages/tensionGraphPage";

export default function App() {
  return (
    // 1) Starta a replicação e contador de sync
    <SyncProvider>
      <Router>
        {/* 2) Modal global de progresso de sync */}
        <SyncProgressModal />

        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/resetPass" element={<ResetPass />} />
          <Route path="/home" element={<HomePageRevenda />} />

          <Route path="/maquina/:machineId" element={<Maquina />} />
          <Route path="/maquina/:machineId/tensao" element={<TensionGraphPage />} />

          <Route path="/debug" element={<DebugPage />} />

          <Route
            path="/clientes/:clientId/machines"
            element={<ClientMachinesPage />}
          />

          <Route
            path="/clientes/:clientId/machines/:machineId"
            element={<MaquinaRevenda />}
          />
        </Routes>
      </Router>
    </SyncProvider>
  );
}
