import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../../stores/new/authStore";

const ProtectedRoute = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  if (!isAuthenticated) return <Navigate to="/" />;

  // Verificação de email pendente
  if (user?.email_verified === false) {
    return <Navigate to="/verify-email" />;
  }

  // Termos de uso não aceitos
  if (user?.terms_accepted === false) {
    return <Navigate to="/accept-terms" />;
  }

  // Conta pendente de aprovação
  if (user?.status === "pending") {
    return <Navigate to="/account-pending" />;
  }

  // Conta rejeitada
  if (user?.status === "rejected") {
    return <Navigate to="/?error=rejected" />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
