import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Login from "./pages/login";
import HomePageRevenda from "./pages/homeClient";
import Maquina from "./pages/machine";
import ResetPass from "./pages/resetPass";
import DebugPage from "./pages/testedb";
//import ClientesPage from "./pages/pageClients";
import ClientMachinesPage from "./pages/clientMachinesPage";
import MaquinaRevenda from "./pages/machineRevenda";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/resetPass" element={<ResetPass />} />
        <Route path="/home" element={<HomePageRevenda />} />

        <Route path="/maquina/:machineId" element={<Maquina />} />

        <Route path="/debug" element={<DebugPage />} />

        {/* clientes */}
        {/* <Route path="/clientes" element={<ClientesPage />} /> */}
        <Route
          path="/clientes/:clientId/machines"
          element={<ClientMachinesPage />}
        />

        {/* detalhe “máquina” dentro do contexto de cliente */}
        <Route
          path="/clientes/:clientId/machines/:machineId"
          element={<MaquinaRevenda />}
        />

      </Routes>
    </Router>
  );
}

export default App;