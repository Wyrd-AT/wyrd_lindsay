// src/App.jsx
import React, { Suspense, lazy } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

const Login = lazy(() => import("./pages/login/SignIn"));
const ForgotPassword = lazy(() => import("./pages/login/ForgotPassword"));
const HomePageRevenda = lazy(() => import("./pages/new/HomePageRevenda"));
const MaquinaRevenda = lazy(() => import("./pages/new/MachineRevenda"));
// FASE 1 - Integrate dashboards
const AdminDashboard = lazy(() => import("./pages/new/AdminDashboard"));
const GerenciarRevendasPage = lazy(() => import("./pages/new/GerenciarRevendasPage"));
const GerenciarClientesPage = lazy(() => import("./pages/new/GerenciarClientesPage"));
const GerenciarPivosPage = lazy(() => import("./pages/new/GerenciarPivosPage"));
const GerenciarClientesRevendaPage = lazy(() => import("./pages/new/GerenciarClientesRevendaPage"));
const GerenciarUsuariosEmpresaPage = lazy(() => import("./pages/new/GerenciarUsuariosEmpresaPage"));
const GerenciarAdminsPage = lazy(() => import("./pages/new/GerenciarAdminsPage"));
// Onboarding - Verificação & Termos
const VerifyEmail = lazy(() => import("./pages/new/VerifyEmail"));
const AcceptTerms = lazy(() => import("./pages/new/AcceptTerms"));
const InvitationActivation = lazy(() => import("./pages/new/InvitationActivation"));
const AccountPending = lazy(() => import("./pages/new/AccountPending"));

import { useAuthStore } from "./stores/new/authStore";
import { useAuthStateValidator } from "./hooks/new/useAuthStateValidator";

import ProtectedRoute from "./components/new/ProtectedRoute";
import SideBar from "./components/new/sidebar";

export default function App() {
  // Validar e limpar estado de autenticação inválido (estado antigo sem type/status)
  useAuthStateValidator();

  const { isAuthenticated } = useAuthStore();

  return (
    <Router>
      <Suspense
        fallback={
          <div className="min-h-screen w-full flex items-center justify-center bg-dashboard-bg-primary">
            <div className="loader-logo" aria-label="Carregando">
              <img src="/fieldnet.svg" alt="FieldNet" className="h-72"/>
            </div>
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Login />} />
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
      </Suspense>
    </Router>
  );
}
