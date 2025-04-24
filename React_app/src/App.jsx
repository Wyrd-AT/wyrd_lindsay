import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Login from "./pages/login";
import ResetPass from "./pages/resetPass";
import HomePageRevenda from "./pages/homeRevenda";
import ClientesPage from "./pages/clientesPage";
import ClienteDetailPage from "./pages/clienteDetailPage";
import Maquina from "./pages/maquina";
import ClienteMaquinaPage from "./pages/clienteMaquinaPage.jsx";
import DebugPage from "./pages/testedb";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/resetPass" element={<ResetPass />} />

        {/* Revenda */}
        <Route path="/home" element={<HomePageRevenda />} />

        {/* Clientes */}
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/clientes/:clientTag" element={<ClienteDetailPage />} />

        {/* Máquina global (revenda) */}
        <Route path="/maquina/:machineId" element={<Maquina />} />

        {/* Máquina específica de cliente */}
        <Route
          path="/clientes/:clientTag/maquina/:machineId"
          element={<ClienteMaquinaPage />}
        />

        <Route path="/debug" element={<DebugPage />} />
      </Routes>
    </Router>
  );
}

export default App;
