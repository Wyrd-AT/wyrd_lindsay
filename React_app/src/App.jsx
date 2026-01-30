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

import { useAuthStore } from "./stores/new/authStore";

import ProtectedRoute from "./components/new/ProtectedRoute";

export default function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    // 1) Starta a replicação e contador de sync
        <Router>
          {/* 2) Modal global de progresso de sync */}

          <Routes>
            <Route path="/" element={<Login />} />
            <Route
              path="/signup"
              element={<SignUp />}
            />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/home" element={<HomePageRevenda />} />

              <Route path="/maquina/:machineId" element={<MaquinaRevenda />} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
  );
}
