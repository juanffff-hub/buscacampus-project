import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ClaimEvidence from "../components/ClaimEvidence.jsx";
import { decideClaim, getClaim, getReceivedClaims } from "../services/api.js";

const PAGE_SIZE = 10;

function formatDate(value) {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function ReceivedClaims() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [retry, setRetry] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const [decidingId, setDecidingId] = useState(null);
  const [notice, setNotice] = useState(null);
  const detailsRequest = useRef(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    getReceivedClaims({ page, limit: PAGE_SIZE })
      .then((result) => {
        if (active) {
          setItems(result.items || []);
          setTotalPages(result.pagination?.totalPages || 0);
        }
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
  }, [retry, page]);

  async function loadDetails(claimId) {
    const requestId = ++detailsRequest.current;
    setExpandedId(claimId);
    setDetails(null);
    setDetailsError(null);
    setDetailsLoading(true);
    try {
      const result = await getClaim(claimId);
      if (detailsRequest.current === requestId) setDetails(result.reclamacion);
    } catch (requestError) {
      if (detailsRequest.current === requestId) setDetailsError(requestError);
    } finally {
      if (detailsRequest.current === requestId) setDetailsLoading(false);
    }
  }

  async function toggleDetails(claimId) {
    if (String(expandedId) === String(claimId)) {
      detailsRequest.current += 1;
      setExpandedId(null);
      setDetails(null);
      setDetailsError(null);
      setDetailsLoading(false);
      return;
    }
    await loadDetails(claimId);
  }

  function changePage(nextPage) {
    detailsRequest.current += 1;
    setExpandedId(null);
    setDetails(null);
    setDetailsError(null);
    setDetailsLoading(false);
    setPage(nextPage);
  }

  async function handleDecision(claim, estado) {
    const action = estado === "Aprobada" ? "aprobar" : "rechazar";
    if (decidingId !== null) return;
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
      detailsRequest.current += 1;
      setExpandedId(null);
      setDetails(null);
      setDetailsLoading(false);
      setPage(1);
      setRetry((value) => value + 1);
    } catch (requestError) {
      setNotice({ type: "error", text: requestError.message || "No fue posible guardar la decisión." });
    } finally {
      setDecidingId(null);
    }
  }

  const pageCount = Math.max(1, totalPages);

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
              {items.map((claim) => (
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
                    <div className="received-claim-actions" aria-label={`Decisión para la reclamación ${claim.id}`}>
                      <button
                        type="button"
                        className="button button-primary"
                        disabled={decidingId !== null}
                        onClick={() => void handleDecision(claim, "Aprobada")}
                      >
                        {decidingId === claim.id ? "Guardando…" : "Aprobar devolución"}
                      </button>
                      <button
                        type="button"
                        className="button button-outline"
                        disabled={decidingId !== null}
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
                    aria-controls={`received-claim-details-${claim.id}`}
                    onClick={() => void toggleDetails(claim.id)}
                  >
                    {String(expandedId) === String(claim.id) ? "Ocultar detalle" : "Ver mensaje y evidencia"}
                  </button>
                  <div
                    id={`received-claim-details-${claim.id}`}
                    className="claim-history-details"
                    hidden={String(expandedId) !== String(claim.id)}
                  >
                    {String(expandedId) === String(claim.id) && (
                      <>
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
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <nav className="claims-pagination" aria-label="Paginación de reclamaciones recibidas">
              <button type="button" aria-label="Ir a la página anterior" disabled={page <= 1} onClick={() => changePage(page - 1)}>Anterior</button>
              <span aria-live="polite" aria-atomic="true">Página {page} de {pageCount}</span>
              <button type="button" aria-label="Ir a la página siguiente" disabled={page >= pageCount} onClick={() => changePage(page + 1)}>Siguiente</button>
            </nav>
          </>
        )}
      </div>
    </section>
  );
}
