import { Link } from "react-router-dom";

export default function Brand({ light = false }) {
  return (
    <Link
      className={`brand ${light ? "brand-light" : ""}`}
      to="/"
      aria-label="BuscaCampus, ir al inicio"
    >
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 42 42" fill="none">
          <path
            d="M21 3.5C11.3 3.5 3.5 11.3 3.5 21S11.3 38.5 21 38.5 38.5 30.7 38.5 21 30.7 3.5 21 3.5Z"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <path
            d="m14.5 21 4.4 4.5L28 16"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>
        busca<span className="brand-accent">campus</span>
        <span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
