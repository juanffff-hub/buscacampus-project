import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <p role="status">Cargando sesión...</p>;
  }

  if (isAuthenticated) {
    const requestedLocation = location.state?.from;
    const requestedPath = requestedLocation?.pathname;
    const destination = requestedPath?.startsWith("/") && !requestedPath.startsWith("//")
      ? `${requestedPath}${requestedLocation.search || ""}${requestedLocation.hash || ""}`
      : "/dashboard";
    return <Navigate to={destination} replace />;
  }

  return <Outlet />;
}
