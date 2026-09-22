import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import Brand from "./Brand.jsx";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

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
          <NavLink to="/" end onClick={() => setOpen(false)}>
            Inicio
          </NavLink>
          <Link
            to="/#explorar"
            onClick={() => {
              setOpen(false);
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
          <NavLink to="/login" onClick={() => setOpen(false)}>
            Iniciar sesión
          </NavLink>
          <Link
            className="button button-small button-primary"
            to="/register"
            onClick={() => setOpen(false)}
          >
            Crear cuenta <span aria-hidden="true">↗</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
