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
import GerenciarRevendasPage from "./pages/new/GerenciarRevendasPage";
import GerenciarClientesPage from "./pages/new/GerenciarClientesPage";
import GerenciarPivosPage from "./pages/new/GerenciarPivosPage";
import GerenciarClientesRevendaPage from "./pages/new/GerenciarClientesRevendaPage";
import GerenciarUsuariosEmpresaPage from "./pages/new/GerenciarUsuariosEmpresaPage";
import GerenciarAdminsPage from "./pages/new/GerenciarAdminsPage";
// Onboarding - Verificação & Termos
import VerifyEmail from "./pages/new/VerifyEmail";
import AcceptTerms from "./pages/new/AcceptTerms";
import InvitationActivation from "./pages/new/InvitationActivation";
import AccountPending from "./pages/new/AccountPending";

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

        {/* Onboarding - Verificação & Termos (fora do ProtectedRoute) */}
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/accept-terms" element={<AcceptTerms />} />
        <Route path="/activate" element={<InvitationActivation />} />
        <Route path="/account-pending" element={<AccountPending />} />

        {/* FASE 1 - Hierarchical dashboards (Admin/Revenda/Cliente) */}
        <Route element={<ProtectedRoute />}>
          {/* Admin Routes */}
          <Route path="/admin" element={<HomePageRevenda />} />
          <Route path="/admin/home" element={<HomePageRevenda />} />

          {/* Gerenciar Admins Page */}
          <Route path="/gerenciar-admins" element={<GerenciarAdminsPage />} />

          {/* Gerenciar Revendas Page */}
          <Route
            path="/gerenciar-revendas"
            element={<GerenciarRevendasPage />}
          />

          {/* Gerenciar Clientes Page */}
          <Route
            path="/gerenciar-clientes"
            element={<GerenciarClientesPage />}
          />

          {/* Gerenciar Clientes - Revenda */}
          <Route
            path="/gerenciar-clientes-revenda"
            element={<GerenciarClientesRevendaPage />}
          />

          {/* Gerenciar Usuários Empresa (Superusuário) */}
          <Route
            path="/gerenciar-usuarios-empresa"
            element={<GerenciarUsuariosEmpresaPage />}
          />

          {/* Gerenciar Pivôs Page */}
          <Route path="/gerenciar-pivos" element={<GerenciarPivosPage />} />

          {/* Legacy routes */}
          <Route path="/home" element={<HomePageRevenda />} />
          <Route path="/maquina/:machineId" element={<MaquinaRevenda />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
