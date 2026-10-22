import { useEffect, useRef, useState } from "react";
import { createReport, getCategories, getLocations } from "../services/api.js";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const EMPTY_FORM = {
  titulo: "",
  descripcion: "",
  categoriaId: "",
  ubicacionId: "",
  tipoReporte: "Perdido",
  fechaHoraEvento: "",
};

function readItems(result) {
  return Array.isArray(result?.items) ? result.items : [];
}

function validate(values, file) {
  const errors = {};
  const title = values.titulo.trim();
  const description = values.descripcion.trim();
  if (title.length < 3 || title.length > 180) {
    errors.titulo = "El título debe tener entre 3 y 180 caracteres.";
  }
  if (!description || description.length > 5000) {
    errors.descripcion = "La descripción es obligatoria y admite hasta 5000 caracteres.";
  }
  if (!values.categoriaId) errors.categoriaId = "Selecciona una categoría.";
  if (!values.ubicacionId) errors.ubicacionId = "Selecciona una ubicación.";
  if (!values.fechaHoraEvento || Number.isNaN(new Date(values.fechaHoraEvento).getTime())) {
    errors.fechaHoraEvento = "Indica cuándo ocurrió el evento.";
  }
  if (!file) {
    errors.archivo = "Adjunta una imagen JPEG, PNG o WebP.";
  } else if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    errors.archivo = "La imagen debe ser JPEG, PNG o WebP.";
  } else if (file.size > MAX_IMAGE_SIZE) {
    errors.archivo = "La imagen no puede superar los 5 MB.";
  }
  return errors;
}

export default function ReportForm({ onCreated, onCancel }) {
  const [values, setValues] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState(null);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInput = useRef(null);

  useEffect(() => {
    let active = true;
    setCatalogLoading(true);
    setCatalogError(null);
    Promise.all([getCategories(), getLocations()])
      .then(([categoryResult, locationResult]) => {
        if (!active) return;
        setCategories(readItems(categoryResult));
        setLocations(readItems(locationResult));
      })
      .catch((error) => {
        if (active) setCatalogError(error);
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });
    return () => { active = false; };
  }, [catalogRetry]);

  useEffect(() => {
    if (!file || typeof URL.createObjectURL !== "function") {
      setPreviewUrl("");
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => {
      if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setRequestError("");
    setSuccess("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;
    const nextErrors = validate(values, file);
    setErrors(nextErrors);
    setRequestError("");
    setSuccess("");
    if (Object.keys(nextErrors).length) return;

    const formData = new FormData();
    formData.append("titulo", values.titulo.trim());
    formData.append("descripcion", values.descripcion.trim());
    formData.append("categoriaId", values.categoriaId);
    formData.append("ubicacionId", values.ubicacionId);
    formData.append("tipoReporte", values.tipoReporte);
    formData.append("fechaHoraEvento", new Date(values.fechaHoraEvento).toISOString());
    formData.append("archivo", file);

    setIsSubmitting(true);
    try {
      const result = await createReport(formData);
      setValues(EMPTY_FORM);
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      setErrors({});
      setSuccess("Tu reporte se publicó correctamente.");
      onCreated?.(result?.report);
    } catch (error) {
      setRequestError(error.message || "No fue posible publicar el reporte.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="report-form-panel" aria-labelledby="report-form-title">
      <div className="report-form-heading">
        <div>
          <span className="section-kicker">NUEVA PUBLICACIÓN</span>
          <h2 id="report-form-title">Publicar un reporte</h2>
        </div>
        {onCancel && <button className="report-form-close" type="button" onClick={onCancel}>Cerrar</button>}
      </div>

      {catalogLoading ? (
        <p className="dashboard-state" role="status">Cargando categorías y ubicaciones…</p>
      ) : catalogError ? (
        <div className="report-form-catalog-error" role="alert">
          <span>No pudimos cargar las categorías y ubicaciones. {catalogError.message}</span>
          <button type="button" onClick={() => setCatalogRetry((value) => value + 1)}>Reintentar</button>
        </div>
      ) : (
        <form className="report-form" onSubmit={handleSubmit} noValidate>
          <div className="report-form-grid">
            <div className="report-field report-field-wide">
              <label htmlFor="report-title">Título</label>
              <input id="report-title" name="titulo" value={values.titulo} onChange={updateField} maxLength={180} aria-invalid={Boolean(errors.titulo)} />
              {errors.titulo && <small className="field-error">{errors.titulo}</small>}
            </div>
            <div className="report-field">
              <label htmlFor="report-type">Tipo de reporte</label>
              <select id="report-type" name="tipoReporte" value={values.tipoReporte} onChange={updateField}>
                <option value="Perdido">Perdido</option>
                <option value="Encontrado">Encontrado</option>
              </select>
            </div>
            <div className="report-field">
              <label htmlFor="report-category">Categoría</label>
              <select id="report-category" name="categoriaId" value={values.categoriaId} onChange={updateField} aria-invalid={Boolean(errors.categoriaId)}>
                <option value="">Selecciona una categoría</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.nombre}</option>)}
              </select>
              {errors.categoriaId && <small className="field-error">{errors.categoriaId}</small>}
            </div>
            <div className="report-field">
              <label htmlFor="report-location">Ubicación</label>
              <select id="report-location" name="ubicacionId" value={values.ubicacionId} onChange={updateField} aria-invalid={Boolean(errors.ubicacionId)}>
                <option value="">Selecciona una ubicación</option>
                {locations.map((location) => <option key={location.id} value={location.id}>{location.nombre}</option>)}
              </select>
              {errors.ubicacionId && <small className="field-error">{errors.ubicacionId}</small>}
            </div>
            <div className="report-field">
              <label htmlFor="report-date">Fecha y hora del evento</label>
              <input id="report-date" type="datetime-local" name="fechaHoraEvento" value={values.fechaHoraEvento} onChange={updateField} aria-invalid={Boolean(errors.fechaHoraEvento)} />
              {errors.fechaHoraEvento && <small className="field-error">{errors.fechaHoraEvento}</small>}
            </div>
            <div className="report-field report-field-wide">
              <label htmlFor="report-description">Descripción</label>
              <textarea id="report-description" name="descripcion" value={values.descripcion} onChange={updateField} maxLength={5000} rows={4} aria-invalid={Boolean(errors.descripcion)} />
              {errors.descripcion && <small className="field-error">{errors.descripcion}</small>}
            </div>
            <div className="report-field report-field-wide">
              <label htmlFor="report-image">Imagen (JPEG, PNG o WebP; máximo 5 MB)</label>
              <input ref={fileInput} id="report-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setFile(event.target.files?.[0] || null); setErrors((current) => ({ ...current, archivo: undefined })); }} aria-invalid={Boolean(errors.archivo)} />
              {errors.archivo && <small className="field-error">{errors.archivo}</small>}
              {previewUrl && <img className="report-image-preview" src={previewUrl} alt="Vista previa de la imagen seleccionada" />}
            </div>
          </div>

          {requestError && <p className="report-form-message report-form-error" role="alert">{requestError}</p>}
          {success && <p className="report-form-message report-form-success" role="status">{success}</p>}
          <div className="report-form-actions">
            {onCancel && <button className="button button-light" type="button" onClick={onCancel} disabled={isSubmitting}>Cancelar</button>}
            <button className="button button-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Publicando…" : "Publicar reporte"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
