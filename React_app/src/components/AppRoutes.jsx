import { Route, Routes } from "react-router-dom";
import PrivateRoute from "./PrivateRoute";
import HomePageRevenda from "../pages/homeClient";
import Login from "../pages/login";
import FallbackRoute from "./FallbackRoute";
import ResetPass from "../pages/resetPass";
import Maquina from "../pages/machine";
import DebugPage from "../pages/testedb";

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="resetPass" element={<ResetPass />} />
      <Route path="debug" element={<DebugPage />} />
      <Route element={<PrivateRoute />}>
        <Route index element={<HomePageRevenda />} />
        <Route path="maquina/:machineId" element={<Maquina />} />
      </Route>
      <Route path="*" element={<FallbackRoute />} />
    </Routes>
  );
};

export default AppRoutes;

// <Route path="/" element={<Login />} />
// <Route path="/home" element={<HomePageRevenda />} />
//
// {/* clientes */}
// <Route path="/clientes" element={<ClientesPage />} />
// <Route
//   path="/clientes/:clientId/machines"
//   element={<ClientMachinesPage />}
// />
//
// {/* detalhe “máquina” dentro do contexto de cliente */}
// <Route
//   path="/clientes/:clientId/machines/:machineId"
//   element={<MaquinaRevenda />}
// />
