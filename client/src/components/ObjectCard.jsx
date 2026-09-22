import ItemArt from "./ItemArt.jsx";

export default function ObjectCard({ item }) {
  return (
    <article className="object-card">
      <div className={`card-art card-art-${item.kind}`}>
        <span
          className={`status-pill ${item.type === "Encontrado" ? "status-found" : "status-lost"}`}
        >
          {item.type === "Encontrado" ? "✓" : "○"} {item.type}
        </span>
        <ItemArt kind={item.kind} />
      </div>
      <div className="card-body">
        <div className="card-meta">
          <span>{item.category}</span>
          <span>{item.date}</span>
        </div>
        <h3>{item.title}</h3>
        <p className="card-location">
          <span aria-hidden="true">⌖</span>
          {item.location}
        </p>
        <p className="card-description">{item.description}</p>
        <span className="card-link">
          Reporte de muestra <span aria-hidden="true">✳</span>
        </span>
      </div>
    </article>
  );
}
