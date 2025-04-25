import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/login";
import HomePageRevenda from "./pages/homeClient";
import Maquina from "./pages/machine";
import ResetPass from "./pages/resetPass";
import DebugPage from "./pages/testedb";
import ClientesPage from "./pages/pageClients";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/resetPass" element={<ResetPass />} />
        <Route path="/home" element={<HomePageRevenda />} />
        <Route path="/maquina/:machineId" element={<Maquina />} />
        <Route path="/debug" element={<DebugPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
      </Routes>
    </Router>
  );
}

export default App;
