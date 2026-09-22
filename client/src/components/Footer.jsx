import { Link } from "react-router-dom";
import Brand from "./Brand.jsx";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <Brand light />
          <p>
            Una comunidad conectada hace que las cosas buenas vuelvan a casa.
          </p>
        </div>
        <div>
          <strong>Explora</strong>
          <Link to="/">Inicio</Link>
          <Link to="/#explorar">Objetos reportados</Link>
          <Link to="/register">Crear cuenta</Link>
        </div>
        <div>
          <strong>Proyecto académico</strong>
          <span>Universidad Autónoma de Occidente</span>
          <span>Santiago de Cali, Colombia</span>
          <span>Avance 1 · Prototipo</span>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} BuscaCampus</span>
        <span>Hecho para la comunidad UAO</span>
      </div>
    </footer>
  );
}
