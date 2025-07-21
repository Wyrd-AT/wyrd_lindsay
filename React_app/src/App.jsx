// src/App.jsx
import React, { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import SyncProvider from "./components/SyncProvider";
import SyncProgressModal from "./components/SyncProgressModal";

import Login from "./pages/SignIn";
import HomePageRevenda from "./pages/homeClient";
import Maquina from "./pages/machine";
import ResetPass from "./pages/resetPass";
import DebugPage from "./pages/testedb";
import ClientMachinesPage from "./pages/clientMachinesPage";
import MaquinaRevenda from "./pages/machineRevenda";
import TensionGraphPage from "./pages/tensionGraphPage";
import SignUp from "./pages/SignUp";
import ForgotPassword from "./pages/ForgotPassword";
import { useAuthStore } from "./stores/authStore";
import ProtectedRoute from "./api/ProtectedRoute";
import { startSyncHandler } from "./api/database";

export default function App() {
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      startSyncHandler();
    }
  }, [isAuthenticated])
  return (
    // 1) Starta a replicação e contador de sync
    <SyncProvider>
      <Router>
        {/* 2) Modal global de progresso de sync */}
        <SyncProgressModal />

        <Routes>
          <Route path="/" element={ <Login />} />
          <Route path="/signup" element={isAuthenticated ? <Navigate to="/home" /> : <SignUp />} />
          <Route path="/resetPass" element={isAuthenticated ? <Navigate to="/home" /> : <ResetPass />} />
          <Route path="/forgot-password" element={isAuthenticated ? <Navigate to="/home" /> : <ForgotPassword />} />
          <Route element={<ProtectedRoute />}>

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
          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </SyncProvider>
  );
}
