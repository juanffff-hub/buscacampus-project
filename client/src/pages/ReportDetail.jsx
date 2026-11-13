import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getApiAssetUrl, getReport } from "../services/api.js";

function formatDate(value) {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function ReportDetail() {
  const { id } = useParams();
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    setReport(null);
    getReport(id)
      .then((result) => {
        if (active) setReport(result.report);
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
  }, [id, retry]);

  return (
    <section className="report-detail-section">
      <div className="container report-detail-container">
        <Link className="report-detail-back" to="/#explorar">
          <span aria-hidden="true">←</span> Volver a explorar
        </Link>

        {isLoading ? (
          <div className="dashboard-state" role="status">Cargando el reporte…</div>
        ) : error ? (
          <div className="dashboard-state dashboard-error" role="alert">
            <h1>No pudimos cargar este reporte</h1>
            <p>{error.message || "Intenta de nuevo en unos momentos."}</p>
            <button
              className="button button-primary"
              type="button"
              onClick={() => setRetry((value) => value + 1)}
            >
              Reintentar
            </button>
          </div>
        ) : report ? (
          <article className="report-detail-card">
            <div className="report-detail-image-wrap">
              {report.imagen?.url ? (
                <img
                  className="report-detail-image"
                  src={getApiAssetUrl(report.imagen.url)}
                  alt={`Fotografía del reporte: ${report.titulo}`}
                />
              ) : (
                <div className="report-detail-image-empty">Imagen no disponible</div>
              )}
            </div>
            <div className="report-detail-content">
              <div className="report-detail-tags">
                <span className={`status-pill-inline ${report.tipoReporte === "Encontrado" ? "status-found" : "status-lost"}`}>
                  {report.tipoReporte}
                </span>
                <span className="report-detail-status">{report.estado}</span>
              </div>
              <span className="section-kicker">DETALLE DEL REPORTE</span>
              <h1>{report.titulo}</h1>
              <p className="report-detail-description">{report.descripcion}</p>
              <dl className="report-detail-facts">
                <div>
                  <dt>Categoría</dt>
                  <dd>{report.categoria?.nombre || "Sin categoría"}</dd>
                </div>
                <div>
                  <dt>Ubicación</dt>
                  <dd>{report.ubicacion?.nombre || "No indicada"}</dd>
                </div>
                <div>
                  <dt>Publicado por</dt>
                  <dd>{report.autor?.nombreCompleto || "Usuario de BuscaCampus"}</dd>
                </div>
                <div>
                  <dt>Fecha del evento</dt>
                  <dd>{formatDate(report.fechaHoraEvento)}</dd>
                </div>
              </dl>
              <p className="report-detail-reference">Reporte #{report.id}</p>
            </div>
          </article>
        ) : null}
      </div>
    </section>
  );
}
