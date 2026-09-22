import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import ItemArt from "../components/ItemArt.jsx";
import ObjectCard from "../components/ObjectCard.jsx";

const items = [
  {
    id: 1,
    title: "Termo verde de acero",
    category: "Otros",
    type: "Encontrado",
    location: "Biblioteca",
    date: "Hoy",
    kind: "bottle",
    description: "Encontrado junto a las mesas de estudio del primer piso.",
  },
  {
    id: 2,
    title: "Llaves con llavero amarillo",
    category: "Llaves",
    type: "Perdido",
    location: "Plazoleta Central",
    date: "Ayer",
    kind: "keys",
    description: "Juego de tres llaves en un llavero de color amarillo.",
  },
  {
    id: 3,
    title: "Billetera azul oscura",
    category: "Documentos",
    type: "Encontrado",
    location: "Cafetería Central",
    date: "Hace 2 días",
    kind: "wallet",
    description: "Billetera encontrada cerca de la entrada principal.",
  },
  {
    id: 4,
    title: "Audífonos inalámbricos",
    category: "Electrónicos",
    type: "Perdido",
    location: "Bloque C",
    date: "Hace 3 días",
    kind: "headphones",
    description: "Audífonos de diadema, color crema, sin estuche.",
  },
];
const categories = [
  "Todas",
  "Electrónicos",
  "Documentos",
  "Llaves",
  "Ropa",
  "Otros",
];
const locations = [
  "Todas las ubicaciones",
  "Biblioteca",
  "Cafetería Central",
  "Bloque C",
  "Plazoleta Central",
];

export default function LandingPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");
  const [location, setLocation] = useState("Todas las ubicaciones");
  const route = useLocation();

  useEffect(() => {
    if (route.hash === "#explorar")
      document.getElementById("explorar")?.scrollIntoView();
  }, [route.hash]);

  const filtered = useMemo(
    () =>
      items.filter((item) => {
        const term = search.trim().toLocaleLowerCase("es");
        return (
          (!term ||
            `${item.title} ${item.description} ${item.location}`
              .toLocaleLowerCase("es")
              .includes(term)) &&
          (category === "Todas" || item.category === category) &&
          (location === "Todas las ubicaciones" || item.location === location)
        );
      }),
    [search, category, location],
  );

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
                <strong>Biblioteca UAO</strong>
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
            <span className="demo-badge">Datos de muestra · Avance 1</span>
          </div>
          <div className="filter-panel">
            <label className="search-field">
              <span className="sr-only">Buscar objetos</span>
              <span aria-hidden="true">⌕</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="¿Qué estás buscando?"
              />
            </label>
            <label className="select-field">
              <span className="sr-only">Filtrar por ubicación</span>
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              >
                {locations.map((loc) => (
                  <option key={loc}>{loc}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="category-list" aria-label="Filtrar por categoría">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`category-chip ${category === cat ? "chip-active" : ""}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          {filtered.length ? (
            <div className="object-grid">
              {filtered.map((item) => (
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
                  setCategory("Todas");
                  setLocation("Todas las ubicaciones");
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
