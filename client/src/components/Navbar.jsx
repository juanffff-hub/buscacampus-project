import { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Brand from "./Brand.jsx";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  function closeMenu() {
    setOpen(false);
  }

  async function handleLogout() {
    if (isLoggingOut) return;
    closeMenu();
    setLogoutError(null);
    setIsLoggingOut(true);
    try {
      await logout();
      navigate("/", { replace: true });
    } catch (error) {
      setLogoutError(error.message || "No fue posible cerrar la sesión.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="site-header">
      <div className="container nav-inner">
        <Brand />
        <button
          className="menu-toggle"
          type="button"
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={open}
          aria-controls="primary-nav"
          onClick={() => setOpen(!open)}
        >
          <span />
          <span />
          <span />
        </button>
        <nav
          id="primary-nav"
          className={`nav-links ${open ? "nav-open" : ""}`}
          aria-label="Navegación principal"
        >
          <NavLink to="/" end onClick={closeMenu}>
            Inicio
          </NavLink>
          <Link
            to="/#explorar"
            onClick={() => {
              closeMenu();
              if (location.pathname === "/")
                setTimeout(
                  () =>
                    document
                      .getElementById("explorar")
                      ?.scrollIntoView({ behavior: "smooth" }),
                  0,
                );
            }}
          >
            Explorar objetos
          </Link>
          {!isLoading &&
            (isAuthenticated ? (
              <>
                <NavLink to="/dashboard" onClick={closeMenu}>
                  {user.nombreCompleto || user.correoElectronico}
                </NavLink>
                <button
                  className="button button-small button-primary"
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                >
                  {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" onClick={closeMenu}>
                  Iniciar sesión
                </NavLink>
                <Link
                  className="button button-small button-primary"
                  to="/register"
                  onClick={closeMenu}
                >
                  Crear cuenta <span aria-hidden="true">↗</span>
                </Link>
              </>
            ))}
          {logoutError && (
            <span className="field-error" role="alert">
              {logoutError}
            </span>
          )}
        </nav>
      </div>
    </header>
  );
}
