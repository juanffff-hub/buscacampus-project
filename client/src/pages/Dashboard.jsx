import { Link } from "react-router-dom";

export default function Dashboard() {
  return (
    <section className="dashboard-placeholder container">
      <span className="section-kicker">PRÓXIMA ETAPA</span>
      <h1>Panel de reportes</h1>
      <p>
        La gestión de publicaciones y reclamaciones se incorporará al conectar
        la autenticación y los módulos transaccionales.
      </p>
      <Link className="button button-primary" to="/">
        Volver al inicio <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
