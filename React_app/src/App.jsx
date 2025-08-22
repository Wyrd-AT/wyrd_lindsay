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
import SyncProgressBar from "./components/SyncProgressModal";


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
        <SyncProgressBar />

        <Routes>
          <Route path="/" element={ <Login />} />
          <Route path="/signup" element={isAuthenticated ? <Navigate to="/home" /> : <SignUp />} />
          <Route path="/forgot-password" element={ <ForgotPassword />} />
          <Route element={<ProtectedRoute />}>

            <Route path="/home" element={<HomePageRevenda />} />

            <Route path="/maquina/:machineId" element={<Maquina />} />

          </Route>
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </SyncProvider>
  );
}
