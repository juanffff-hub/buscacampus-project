import { useEffect, useState } from "react";

export default function ObjectCard({ item }) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => setImageError(false), [item.imageUrl]);

  return (
    <article className="object-card">
      <div className="card-art">
        <span
          className={`status-pill ${item.type === "Encontrado" ? "status-found" : "status-lost"}`}
        >
          {item.type === "Encontrado" ? "✓" : "○"} {item.type}
        </span>
        {item.imageUrl && !imageError ? (
          <img
            className="card-photo"
            src={item.imageUrl}
            alt={`Fotografía del reporte: ${item.title}`}
            loading="lazy"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="card-photo-placeholder">Imagen no disponible</div>
        )}
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
          Reporte #{item.id} <span aria-hidden="true">✳</span>
        </span>
      </div>
    </article>
  );
}
