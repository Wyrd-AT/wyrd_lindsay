import { Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";

const FallbackRoute = () => {
  const { currentUser } = useAuth();

  return currentUser ? (
    <Navigate to="/" replace />
  ) : (
    <Navigate to="/login  " replace />
  );
};

export default FallbackRoute;
