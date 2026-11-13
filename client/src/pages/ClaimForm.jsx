import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createClaim, getApiAssetUrl, getReport } from "../services/api.js";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function validateEvidence(file) {
  if (!file) return "Adjunta una imagen como evidencia.";
  if (!ALLOWED_TYPES.has(file.type)) {
    return "La evidencia debe ser una imagen JPEG, PNG o WebP.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "La imagen debe pesar máximo 5 MB.";
  }
  return "";
}

export default function ClaimForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [retry, setRetry] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    getReport(id)
      .then((result) => {
        if (active) setReport(result.report);
      })
      .catch((error) => {
        if (active) setLoadError(error);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, retry]);

  useEffect(() => {
    if (!selectedFile || typeof URL.createObjectURL !== "function") {
      setPreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
    setFileError(validateEvidence(file));
    setSubmitError(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;
    const values = new FormData(event.currentTarget);
    const message = String(values.get("mensajePrueba") || "").trim();
    if (message.length < 10 || message.length > 2000) {
      setSubmitError("El mensaje debe tener entre 10 y 2.000 caracteres.");
      return;
    }
    const validationError = validateEvidence(selectedFile);
    setFileError(validationError);
    if (validationError) return;

    const formData = new FormData();
    formData.set("mensajePrueba", message);
    formData.set("archivo", selectedFile);
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await createClaim(id, formData);
      navigate(`/reportes/${encodeURIComponent(id)}`, {
        replace: true,
        state: { claimNotice: "Reclamación enviada. El autor revisará tu evidencia." },
      });
    } catch (error) {
      setSubmitError(error.message || "No fue posible enviar la reclamación.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="claim-form-section">
      <div className="container claim-form-container">
        <Link className="report-detail-back" to={`/reportes/${encodeURIComponent(id)}`}>
          <span aria-hidden="true">←</span> Volver al reporte
        </Link>
        {isLoading ? (
          <div className="dashboard-state" role="status">Cargando el reporte…</div>
        ) : loadError ? (
          <div className="dashboard-state dashboard-error" role="alert">
            <h1>No pudimos cargar el reporte</h1>
            <p>{loadError.message}</p>
            <button className="button button-primary" type="button" onClick={() => setRetry((value) => value + 1)}>
              Reintentar
            </button>
          </div>
        ) : report ? (
          <div className="claim-form-card">
            <div className="claim-form-report">
              {report.imagen?.url && (
                <img src={getApiAssetUrl(report.imagen.url)} alt={`Fotografía del reporte: ${report.titulo}`} />
              )}
              <div>
                <span className="section-kicker">RECLAMACIÓN DE OBJETO ENCONTRADO</span>
                <h1>{report.titulo}</h1>
                <p>{report.ubicacion?.nombre || "Ubicación no indicada"} · {report.estado}</p>
              </div>
            </div>
            <form className="claim-form" onSubmit={handleSubmit}>
              <p className="claim-form-help">
                Describe una característica o detalle que permita al autor verificar que el objeto te pertenece.
              </p>
              <label htmlFor="claim-message">Mensaje de prueba</label>
              <textarea
                id="claim-message"
                name="mensajePrueba"
                rows="5"
                minLength="10"
                maxLength="2000"
                placeholder="Por ejemplo: puedo describir una marca, contenido o detalle que no aparece en el reporte."
                required
              />
              <small className="field-help">Escribe entre 10 y 2.000 caracteres. Evita incluir información sensible.</small>

              <label htmlFor="claim-evidence">Imagen de evidencia</label>
              <input
                id="claim-evidence"
                name="archivo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-describedby="claim-evidence-help claim-file-error"
                onChange={handleFileChange}
                required
              />
              <small id="claim-evidence-help" className="field-help">
                JPEG, PNG o WebP, hasta 5 MB. La imagen solo será visible para ti, el autor y la administración.
              </small>
              {fileError && <p id="claim-file-error" className="field-error" role="alert">{fileError}</p>}
              {selectedFile && previewUrl && !fileError && (
                <figure className="claim-evidence-preview">
                  <img src={previewUrl} alt="Vista previa de la evidencia seleccionada" />
                  <figcaption>{selectedFile.name}</figcaption>
                </figure>
              )}
              {submitError && <p className="field-error" role="alert">{submitError}</p>}
              <div className="claim-form-actions">
                <Link className="button button-outline" to={`/reportes/${encodeURIComponent(id)}`}>
                  Cancelar
                </Link>
                <button className="button button-primary" type="submit" disabled={isSubmitting || Boolean(fileError)}>
                  {isSubmitting ? "Enviando reclamación…" : "Enviar reclamación"}
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </div>
    </section>
  );
}
