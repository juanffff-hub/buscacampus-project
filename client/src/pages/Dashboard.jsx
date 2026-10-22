import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ObjectCard from "../components/ObjectCard.jsx";
import ReportForm from "../components/ReportForm.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiAssetUrl, getReports } from "../services/api.js";

function toCardItem(report) {
  const rawDate = report.fechaCreacion || report.fechaHoraEvento;
  const date = rawDate && !Number.isNaN(new Date(rawDate).getTime())
    ? new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(new Date(rawDate))
    : "Fecha no disponible";
  return {
    id: report.id,
    title: report.titulo,
    category: report.categoria?.nombre || "Sin categoría",
    type: report.tipoReporte,
    status: report.estado,
    location: report.ubicacion?.nombre || "Ubicación no disponible",
    date,
    description: report.descripcion,
    imageUrl: getApiAssetUrl(report.imagen?.url),
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);

  function handleCreated(report) {
    if (report) {
      setReports((current) => [
        toCardItem(report),
        ...current.filter((item) => String(item.id) !== String(report.id)),
      ]);
    } else {
      setRetry((value) => value + 1);
    }
  }

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    getReports({ mios: true, page: 1, limit: 50 })
      .then((result) => {
        if (active) setReports((result.items || []).map(toCardItem));
      })
      .catch((requestError) => {
        if (active) setError(requestError);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retry]);

  return (
    <section className="dashboard-section">
      <div className="container">
        <div className="dashboard-heading">
          <div>
            <span className="section-kicker">PANEL PERSONAL</span>
            <h1>Mis reportes</h1>
            <p>
              {user?.nombreCompleto
                ? `Hola, ${user.nombreCompleto}. Aquí puedes consultar tus publicaciones.`
                : "Aquí puedes consultar tus publicaciones."}
            </p>
          </div>
          <div className="dashboard-heading-actions">
            <button
              className="button button-primary"
              type="button"
              onClick={() => setShowCreateForm((visible) => !visible)}
              aria-expanded={showCreateForm}
              aria-controls="create-report-panel"
            >
              {showCreateForm ? "Ocultar formulario" : "Publicar reporte"}
            </button>
            <div className="dashboard-summary" aria-label="Resumen de publicaciones">
              <strong>{reports.length}</strong>
              <span>{reports.length === 1 ? "reporte propio" : "reportes propios"}</span>
            </div>
          </div>
        </div>

        {showCreateForm && (
          <div id="create-report-panel" className="dashboard-create-panel">
            <ReportForm onCreated={handleCreated} onCancel={() => setShowCreateForm(false)} />
          </div>
        )}

        {isLoading ? (
          <div className="dashboard-state" role="status">
            Cargando tus reportes…
          </div>
        ) : error ? (
          <div className="dashboard-state dashboard-error" role="alert">
            <strong>No pudimos cargar tus reportes.</strong>
            <p>{error.message}</p>
            <button
              className="button button-primary"
              type="button"
              onClick={() => setRetry((value) => value + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : reports.length === 0 ? (
          <div className="dashboard-state dashboard-empty">
            <span className="empty-illustration" aria-hidden="true">＋</span>
            <h2>Aún no tienes reportes</h2>
            <p>Cuando publiques un objeto, aparecerá aquí para que puedas darle seguimiento.</p>
            <Link className="button button-primary" to="/#explorar">
              Explorar reportes
            </Link>
          </div>
        ) : (
          <div className="dashboard-report-grid" aria-live="polite">
            {reports.map((report) => (
              <article className="owned-report" key={report.id}>
                <div className="owned-report-label">
                  <span>Publicado por ti</span>
                  <span>{report.status}</span>
                </div>
                <ObjectCard item={report} />
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
