import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ObjectCard from "../components/ObjectCard.jsx";
import ReportForm from "../components/ReportForm.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { deleteReport, getApiAssetUrl, getReports } from "../services/api.js";

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
    source: report,
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [actionNotice, setActionNotice] = useState(null);

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

  function handleUpdated(report) {
    if (report) {
      setReports((current) => current.map((item) => (
        String(item.id) === String(report.id) ? toCardItem(report) : item
      )));
    } else {
      setRetry((value) => value + 1);
    }
    setEditingId(null);
    setActionNotice({ type: "success", text: "El reporte se actualizó correctamente." });
  }

  async function handleDelete(report) {
    if (!window.confirm(`¿Eliminar el reporte “${report.title}”? Esta acción no se puede deshacer.`)) return;
    setDeletingId(report.id);
    setActionNotice(null);
    try {
      await deleteReport(report.id);
      setReports((current) => current.filter((item) => String(item.id) !== String(report.id)));
      setActionNotice({ type: "success", text: "El reporte se eliminó correctamente." });
      if (String(editingId) === String(report.id)) setEditingId(null);
    } catch (requestError) {
      setActionNotice({ type: "error", text: requestError.message || "No fue posible eliminar el reporte." });
    } finally {
      setDeletingId(null);
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

        {actionNotice && (
          <p className={`dashboard-action-notice ${actionNotice.type === "error" ? "dashboard-action-error" : "dashboard-action-success"}`} role={actionNotice.type === "error" ? "alert" : "status"}>
            {actionNotice.text}
          </p>
        )}

        {editingId !== null && (() => {
          const editingReport = reports.find((item) => String(item.id) === String(editingId));
          return editingReport ? (
            <div className="dashboard-create-panel">
              <ReportForm
                key={`edit-${editingReport.id}`}
                report={editingReport.source}
                onSaved={handleUpdated}
                onCancel={() => setEditingId(null)}
              />
            </div>
          ) : null;
        })()}

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
                <div className="owned-report-actions">
                  <button type="button" onClick={() => { setActionNotice(null); setEditingId(report.id); }}>Editar</button>
                  <button type="button" onClick={() => handleDelete(report)} disabled={deletingId === report.id}>
                    {deletingId === report.id ? "Eliminando…" : "Eliminar"}
                  </button>
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
