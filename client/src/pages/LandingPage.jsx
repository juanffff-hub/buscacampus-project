import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import ItemArt from "../components/ItemArt.jsx";
import ObjectCard from "../components/ObjectCard.jsx";
import { getApiAssetUrl, getCategories, getLocations, getReports } from "../services/api.js";

function formatReportDate(value) {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" }).format(date);
}

function toCardItem(report) {
  return {
    id: report.id,
    title: report.titulo,
    category: report.categoria?.nombre || "Sin categoría",
    type: report.tipoReporte,
    status: report.estado,
    location: report.ubicacion?.nombre || "Ubicación no disponible",
    date: formatReportDate(report.fechaCreacion || report.fechaHoraEvento),
    description: report.descripcion,
    imageUrl: getApiAssetUrl(report.imagen?.url),
  };
}

export default function LandingPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [reports, setReports] = useState([]);
  const [catalogError, setCatalogError] = useState(null);
  const [reportError, setReportError] = useState(null);
  const [catalogsLoading, setCatalogsLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [reportRetry, setReportRetry] = useState(0);
  const route = useLocation();

  useEffect(() => {
    if (route.hash === "#explorar")
      document.getElementById("explorar")?.scrollIntoView();
  }, [route.hash]);

  useEffect(() => {
    let active = true;
    setCatalogsLoading(true);
    setCatalogError(null);
    Promise.all([getCategories(), getLocations()])
      .then(([categoryResult, locationResult]) => {
        if (!active) return;
        setCategories(categoryResult.items || []);
        setLocations(locationResult.items || []);
      })
      .catch((error) => {
        if (active) setCatalogError(error);
      })
      .finally(() => {
        if (active) setCatalogsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [catalogRetry]);

  useEffect(() => {
    let active = true;
    setReportsLoading(true);
    setReportError(null);
    getReports({
      q: search,
      categoriaId: categoryId,
      ubicacionId: locationId,
      page: 1,
      limit: 12,
    })
      .then((result) => {
        if (active) setReports((result.items || []).map(toCardItem));
      })
      .catch((error) => {
        if (active) setReportError(error);
      })
      .finally(() => {
        if (active) setReportsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search, categoryId, locationId, reportRetry]);

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="eyebrow-dot" /> La comunidad UAO se encuentra
              aquí
            </span>
            <h1>
              Lo que se pierde,
              <br />
              <em>nos une.</em>
            </h1>
            <p>
              Un espacio para encontrar lo que falta y devolver lo que alguien
              más busca. Juntos hacemos del campus un lugar más cercano.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" to="/register">
                Reportar un objeto <span aria-hidden="true">↗</span>
              </Link>
              <a className="button button-outline" href="#explorar">
                Buscar un objeto <span aria-hidden="true">⌕</span>
              </a>
            </div>
            <div className="hero-note">
              <span className="note-avatars">
                <b>UA</b>
                <b>O</b>
                <b>+</b>
              </span>
              <span>Una red de apoyo para nuestra comunidad</span>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="visual-orbit orbit-one" />
            <div className="visual-orbit orbit-two" />
            <div className="hero-object">
              <ItemArt kind="bottle" />
            </div>
            <div className="floating-card floating-top">
              <span className="float-icon">⌖</span>
              <div>
                <small>Visto por última vez</small>
                <strong>Biblioteca Piso 1</strong>
              </div>
            </div>
            <div className="floating-card floating-bottom">
              <span className="float-check">✓</span>
              <div>
                <small>Buenas noticias</small>
                <strong>¡Alguien lo encontró!</strong>
              </div>
            </div>
            <div className="visual-spark spark-one">✳</div>
            <div className="visual-spark spark-two">✦</div>
          </div>
        </div>
        <div className="container hero-stats">
          <span>
            <strong>01</strong> Busca entre los reportes
          </span>
          <span>
            <strong>02</strong> Conecta con la comunidad
          </span>
          <span>
            <strong>03</strong> Recupera lo que es tuyo
          </span>
        </div>
      </section>

      <section className="how-section">
        <div className="container how-grid">
          <div>
            <span className="section-kicker">ASÍ DE SENCILLO</span>
            <h2>
              Pequeñas acciones.
              <br />
              Grandes reencuentros.
            </h2>
          </div>
          <p>
            ¿Perdiste algo o encontraste un objeto? En BuscaCampus cada reporte
            ayuda a que una historia tenga un buen final.
          </p>
        </div>
      </section>

      <section id="explorar" className="explore-section">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">EXPLORA EL CAMPUS</span>
              <h2>
                Objetos reportados <span>recientemente</span>
              </h2>
              <p>Descubre lo que la comunidad ha perdido y encontrado.</p>
            </div>
            <span className="demo-badge">Reportes de la comunidad UAO</span>
          </div>
          {catalogError && (
            <div className="inline-error" role="alert">
              <span>No pudimos cargar las categorías y ubicaciones.</span>
              <button type="button" onClick={() => setCatalogRetry((value) => value + 1)}>
                Reintentar catálogos
              </button>
            </div>
          )}
          <div className="filter-panel">
            <label className="search-field">
              <span className="sr-only">Buscar objetos</span>
              <span aria-hidden="true">⌕</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="¿Qué estás buscando?"
                aria-label="Buscar reportes"
              />
            </label>
            <label className="select-field">
              <span className="sr-only">Filtrar por ubicación</span>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                disabled={catalogsLoading || Boolean(catalogError)}
                aria-label="Filtrar por ubicación"
              >
                <option value="">Todas las ubicaciones</option>
                {locations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="category-list" aria-label="Filtrar por categoría">
            <button
              type="button"
              className={`category-chip ${categoryId === "" ? "chip-active" : ""}`}
              aria-pressed={categoryId === ""}
              onClick={() => setCategoryId("")}
            >
              Todas
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`category-chip ${categoryId === String(category.id) ? "chip-active" : ""}`}
                aria-pressed={categoryId === String(category.id)}
                onClick={() => setCategoryId(String(category.id))}
                disabled={catalogsLoading || Boolean(catalogError)}
              >
                {category.nombre}
              </button>
            ))}
          </div>
          {reportsLoading ? (
            <div className="empty-state" role="status">
              Cargando reportes…
            </div>
          ) : reportError ? (
            <div className="empty-state" role="alert">
              <strong>No pudimos cargar los reportes.</strong>
              <p>{reportError.message}</p>
              <button type="button" onClick={() => setReportRetry((value) => value + 1)}>
                Reintentar
              </button>
            </div>
          ) : reports.length > 0 ? (
            <div className="object-grid" aria-live="polite">
              {reports.map((item) => (
                <ObjectCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>No encontramos objetos con esos filtros.</strong>
              <p>Prueba otra categoría, ubicación o palabra.</p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategoryId("");
                  setLocationId("");
                }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="cta-section">
        <div className="container cta-box">
          <div className="cta-decoration">✳</div>
          <div>
            <span className="section-kicker">TU GESTO IMPORTA</span>
            <h2>
              ¿Encontraste algo?
              <br />
              Ayuda a que vuelva a casa.
            </h2>
            <p>
              Un reporte puede alegrarle el día a alguien de nuestra comunidad.
            </p>
          </div>
          <Link to="/register" className="button button-light">
            Publicar un hallazgo <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </>
  );
}
