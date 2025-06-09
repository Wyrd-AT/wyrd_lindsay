import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./useAuth";
import SideBar from "./sidebar";

const PrivateRoute = () => {
  const { currentUser, authLoading } = useAuth();

  if (authLoading) {
    return null;
  }

  if (currentUser) {
    return (
      <div>
        <Outlet />
      </div>
    );
  }

  // return currentUser ? <Outlet /> : <Navigate to="/login" replace />;
  return <Navigate to="/login" replace />;
};

export default PrivateRoute;
