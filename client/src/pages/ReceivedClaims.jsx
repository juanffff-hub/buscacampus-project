import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ClaimEvidence from "../components/ClaimEvidence.jsx";
import { decideClaim, getClaim, getReportClaims, getReports } from "../services/api.js";

const PAGE_SIZE = 10;

function formatDate(value) {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

async function getAllMyFoundReports() {
  const first = await getReports({ mios: true, page: 1, limit: 100 });
  const reports = [...(first.items || [])];
  const totalPages = first.pagination?.totalPages || 1;
  for (let page = 2; page <= totalPages; page += 1) {
    const result = await getReports({ mios: true, page, limit: 100 });
    reports.push(...(result.items || []));
  }
  return reports.filter((report) => report.tipoReporte === "Encontrado");
}

async function getAllClaimsForReport(reportId) {
  const first = await getReportClaims(reportId, { page: 1, limit: 100 });
  const claims = [...(first.items || [])];
  const totalPages = first.pagination?.totalPages || 1;
  for (let page = 2; page <= totalPages; page += 1) {
    const result = await getReportClaims(reportId, { page, limit: 100 });
    claims.push(...(result.items || []));
  }
  return claims;
}

async function loadReceivedClaims() {
  const reports = await getAllMyFoundReports();
  const groups = await Promise.all(
    reports.map(async (report) => ({
      reportId: report.id,
      claims: await getAllClaimsForReport(report.id),
    })),
  );
  return groups.flatMap((group) => group.claims)
    .sort((first, second) => new Date(second.fechaReclamacion) - new Date(first.fechaReclamacion));
}

export default function ReceivedClaims() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [decidingId, setDecidingId] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    loadReceivedClaims()
      .then((claims) => {
        if (active) setItems(claims);
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

  async function loadDetails(claimId) {
    setExpandedId(claimId);
    setDetails(null);
    setDetailsError(null);
    setDetailsLoading(true);
    try {
      const result = await getClaim(claimId);
      setDetails(result.reclamacion);
    } catch (requestError) {
      setDetailsError(requestError);
    } finally {
      setDetailsLoading(false);
    }
  }

  async function toggleDetails(claimId) {
    if (String(expandedId) === String(claimId)) {
      setExpandedId(null);
      setDetails(null);
      setDetailsError(null);
      return;
    }
    await loadDetails(claimId);
  }

  async function handleDecision(claim, estado) {
    const action = estado === "Aprobada" ? "aprobar" : "rechazar";
    const consequence = estado === "Aprobada"
      ? "El reporte quedará devuelto y las demás solicitudes pendientes se rechazarán."
      : "La reclamación quedará rechazada; el reporte se publicará si no quedan solicitudes activas.";
    if (!window.confirm(`¿Deseas ${action} la reclamación de ${claim.reclamante?.nombreCompleto || "este usuario"}? ${consequence}`)) {
      return;
    }

    setDecidingId(claim.id);
    setNotice(null);
    try {
      await decideClaim(claim.id, estado);
      setNotice({ type: "success", text: estado === "Aprobada" ? "Reclamación aprobada y reporte actualizado." : "Reclamación rechazada y reporte actualizado." });
      setExpandedId(null);
      setDetails(null);
      setPage(1);
      setRetry((value) => value + 1);
    } catch (requestError) {
      setNotice({ type: "error", text: requestError.message || "No fue posible guardar la decisión." });
    } finally {
      setDecidingId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <section className="claims-section">
      <div className="container claims-container">
        <div className="claims-heading">
          <span className="section-kicker">REVISIÓN DE HALLAZGOS</span>
          <h1>Reclamaciones recibidas</h1>
          <p>Revisa las solicitudes de devolución y la evidencia que te compartió cada persona.</p>
        </div>
        {notice && (
          <p className={`dashboard-action-notice ${notice.type === "error" ? "dashboard-action-error" : "dashboard-action-success"}`} role={notice.type === "error" ? "alert" : "status"}>
            {notice.text}
          </p>
        )}
        {isLoading ? (
          <div className="dashboard-state" role="status">Cargando reclamaciones recibidas…</div>
        ) : error ? (
          <div className="dashboard-state dashboard-error" role="alert">
            <strong>No pudimos cargar las reclamaciones recibidas.</strong>
            <p>{error.message}</p>
            <button className="button button-primary" type="button" onClick={() => setRetry((value) => value + 1)}>
              Reintentar
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="dashboard-state dashboard-empty">
            <h2>No tienes reclamaciones pendientes ni historial recibido</h2>
            <p>Cuando alguien reclame uno de tus objetos encontrados, aparecerá aquí para que puedas revisarlo.</p>
            <Link className="button button-primary" to="/dashboard">Volver a mis reportes</Link>
          </div>
        ) : (
          <>
            <div className="claims-list" aria-live="polite">
              {pageItems.map((claim) => (
                <article className="claim-history-card" key={claim.id}>
                  <div className="claim-history-main">
                    <div>
                      <span className={`claim-status claim-status-${claim.estado.toLowerCase()}`}>
                        {claim.estado}
                      </span>
                      <h2>{claim.reporte?.titulo || `Reporte #${claim.reporte?.id}`}</h2>
                      <p>Reclamado por {claim.reclamante?.nombreCompleto || "Usuario"}</p>
                      <small>Recibida el {formatDate(claim.fechaReclamacion)}</small>
                    </div>
                    <Link className="button button-outline" to={`/reportes/${encodeURIComponent(claim.reporte?.id)}`}>
                      Ver reporte
                    </Link>
                  </div>
                  {claim.estado === "Pendiente" && (
                    <div className="received-claim-actions">
                      <button
                        type="button"
                        className="button button-primary"
                        disabled={decidingId === claim.id}
                        onClick={() => void handleDecision(claim, "Aprobada")}
                      >
                        {decidingId === claim.id ? "Guardando…" : "Aprobar devolución"}
                      </button>
                      <button
                        type="button"
                        className="button button-outline"
                        disabled={decidingId === claim.id}
                        onClick={() => void handleDecision(claim, "Rechazada")}
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                  <button
                    className="claim-details-toggle"
                    type="button"
                    aria-expanded={String(expandedId) === String(claim.id)}
                    onClick={() => void toggleDetails(claim.id)}
                  >
                    {String(expandedId) === String(claim.id) ? "Ocultar detalle" : "Ver mensaje y evidencia"}
                  </button>
                  {String(expandedId) === String(claim.id) && (
                    <div className="claim-history-details">
                      {detailsLoading ? (
                        <p role="status">Cargando detalle…</p>
                      ) : detailsError ? (
                        <div role="alert">
                          <p>{detailsError.message}</p>
                          <button type="button" onClick={() => void loadDetails(claim.id)}>Reintentar</button>
                        </div>
                      ) : details ? (
                        <>
                          <p><strong>Mensaje de prueba:</strong> {details.mensajePrueba}</p>
                          <p><strong>Estado actual del reporte:</strong> {details.reporte?.estado}</p>
                          <ClaimEvidence claimId={claim.id} evidence={details.evidencia} />
                        </>
                      ) : null}
                    </div>
                  )}
                </article>
              ))}
            </div>
            <div className="claims-pagination" aria-label="Paginación de reclamaciones recibidas">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</button>
              <span>Página {page} de {totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Siguiente</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
