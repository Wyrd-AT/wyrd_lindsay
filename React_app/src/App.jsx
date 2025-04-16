import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/login";
import HomePageRevenda from "./pages/homeRevenda";
import Maquina from "./pages/maquina";
import Tensao from "./pages/tensao";       // Nova página para leitura de tensões e gráfico
import Mensagem from "./pages/mensagem";   // Nova página para envio/recebimento de mensagens
import ResetPass from "./pages/resetPass";
import MinhaPagina from './pages/minhaPagina';
import DebugPage from "./pages/testedb";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/resetPass" element={<ResetPass />} />
        <Route path="/home" element={<HomePageRevenda />} />
        <Route path="/maquina/:machineId" element={<Maquina />} />
        <Route path="/tensao/:machineId" element={<Tensao />} />
        <Route path="/mensagem" element={<Mensagem />} />
        <Route path="/debug" element={<DebugPage />} />
        <Route path="/minhapagina" element={<MinhaPagina />} />
      </Routes>
    </Router>
  );
}

export default App;
