// src/App.jsx
import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/new/SignIn";
import HomePageRevenda from "./pages/new/HomePageRevenda";
import MaquinaRevenda from "./pages/new/MachineRevenda";
import SignUp from "./pages/new/SignUp";
import ForgotPassword from "./pages/new/ForgotPassword";
// FASE 1 - Integrate dashboards
import AdminDashboard from "./pages/new/AdminDashboard";
import RevendaDashboard from "./pages/new/RevendaDashboard";
import ClienteDashboard from "./pages/new/ClienteDashboard";

import { useAuthStore } from "./stores/new/authStore";
import { useAuthStateValidator } from "./hooks/new/useAuthStateValidator";

import ProtectedRoute from "./components/new/ProtectedRoute";

export default function App() {
  // Validar e limpar estado de autenticação inválido (estado antigo sem type/status)
  useAuthStateValidator();
  
  const { isAuthenticated } = useAuthStore();

  return (
    // 1) Starta a replicação e contador de sync
        <Router>
          {/* 2) Modal global de progresso de sync */}

          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* FASE 1 - Hierarchical dashboards (Admin/Revenda/Cliente) */}
            <Route element={<ProtectedRoute />}>
              {/* Admin Dashboard */}
              <Route path="/admin" element={<AdminDashboard />} />

              {/* Revenda Dashboard */}
              <Route path="/revenda" element={<RevendaDashboard />} />

              {/* Cliente Dashboard */}
              <Route path="/cliente" element={<ClienteDashboard />} />

              {/* Legacy routes */}
              <Route path="/home" element={<HomePageRevenda />} />
              <Route path="/maquina/:machineId" element={<MaquinaRevenda />} />
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
  );
}
