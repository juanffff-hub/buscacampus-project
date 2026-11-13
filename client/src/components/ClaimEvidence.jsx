import { useEffect, useState } from "react";
import { getClaimEvidence } from "../services/api.js";

export default function ClaimEvidence({ claimId, evidence }) {
  const [isVisible, setIsVisible] = useState(false);
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!isVisible) return undefined;
    let active = true;
    let objectUrl = "";
    setIsLoading(true);
    setError(null);
    setUrl("");
    getClaimEvidence(claimId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((requestError) => {
        if (active) setError(requestError);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [claimId, isVisible, retry]);

  if (!evidence) return <p>Esta reclamación no tiene evidencia disponible.</p>;
  if (!isVisible) {
    return <button type="button" onClick={() => setIsVisible(true)}>Ver evidencia privada</button>;
  }
  if (isLoading) return <p role="status">Cargando evidencia privada…</p>;
  if (error) {
    return (
      <div role="alert">
        <p>{error.message}</p>
        <button type="button" onClick={() => setRetry((value) => value + 1)}>Reintentar</button>
      </div>
    );
  }
  if (!url) return null;

  return (
    <figure className="claim-evidence-preview">
      <img src={url} alt={`Evidencia privada: ${evidence.nombreOriginal}`} />
      <figcaption>
        <span>{evidence.nombreOriginal}</span>{" "}
        <a href={url} download={evidence.nombreOriginal}>Descargar evidencia</a>
      </figcaption>
    </figure>
  );
}
