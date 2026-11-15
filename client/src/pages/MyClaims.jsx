import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ClaimEvidence from "../components/ClaimEvidence.jsx";
import { getClaim, getMyClaims } from "../services/api.js";

const PAGE_SIZE = 10;

function formatDate(value) {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function MyClaims() {
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const detailsRequest = useRef(0);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    getMyClaims({ page, limit: PAGE_SIZE })
      .then((result) => {
        if (!active) return;
        setItems(result.items || []);
        setPagination(result.pagination || { page, totalPages: 1, total: 0 });
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
  }, [page, retry]);

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

  return (
    <section className="claims-section">
      <div className="container claims-container">
        <div className="claims-heading">
          <span className="section-kicker">SEGUIMIENTO PERSONAL</span>
          <h1>Mis reclamaciones</h1>
          <p>Consulta el estado de tus solicitudes y la evidencia que enviaste.</p>
        </div>
        {isLoading ? (
          <div className="dashboard-state" role="status">Cargando tus reclamaciones…</div>
        ) : error ? (
          <div className="dashboard-state dashboard-error" role="alert">
            <strong>No pudimos cargar tus reclamaciones.</strong>
            <p>{error.message}</p>
            <button className="button button-primary" type="button" onClick={() => setRetry((value) => value + 1)}>
              Reintentar
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="dashboard-state dashboard-empty">
            <h2>Aún no has enviado reclamaciones</h2>
            <p>Cuando solicites la devolución de un objeto encontrado, podrás consultar aquí su seguimiento.</p>
            <Link className="button button-primary" to="/#explorar">Explorar reportes</Link>
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
                      <p>{claim.reporte?.tipoReporte} · Reporte #{claim.reporte?.id}</p>
                      <small>Enviada el {formatDate(claim.fechaReclamacion)}</small>
                    </div>
                    <Link className="button button-outline" to={`/reportes/${encodeURIComponent(claim.reporte?.id)}`}>
                      Ver reporte
                    </Link>
                  </div>
                  <button
                    className="claim-details-toggle"
                    type="button"
                    aria-expanded={String(expandedId) === String(claim.id)}
                    aria-controls={`my-claim-details-${claim.id}`}
                    onClick={() => void toggleDetails(claim.id)}
                  >
                    {String(expandedId) === String(claim.id) ? "Ocultar detalle" : "Ver detalle y evidencia"}
                  </button>
                  <div
                    id={`my-claim-details-${claim.id}`}
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
                          <p><strong>Tu mensaje:</strong> {details.mensajePrueba}</p>
                          <p><strong>Autor del reporte:</strong> {details.reporte?.autor?.nombreCompleto}</p>
                          <ClaimEvidence claimId={claim.id} evidence={details.evidencia} />
                        </>
                      ) : null}
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <nav className="claims-pagination" aria-label="Paginación de mis reclamaciones">
              <button type="button" aria-label="Ir a la página anterior" disabled={page <= 1} onClick={() => changePage(page - 1)}>
                Anterior
              </button>
              <span>Página {pagination.page || page} de {Math.max(1, pagination.totalPages || 1)}</span>
              <button
                type="button"
                aria-label="Ir a la página siguiente"
                disabled={page >= (pagination.totalPages || 1)}
                onClick={() => changePage(page + 1)}
              >
                Siguiente
              </button>
            </nav>
          </>
        )}
      </div>
    </section>
  );
}
