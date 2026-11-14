const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1")
  .replace(/\/+$/, "");
const API_ORIGIN = API_URL.replace(/\/api\/v1$/i, "");

export class ApiError extends Error {
  constructor(message, { status = 0, code = "REQUEST_FAILED", details = [] } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = Array.isArray(details) ? details : [];
  }
}

export async function apiRequest(path, options = {}) {
  const { responseType = "json", ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers || {});
  const isFormData =
    typeof FormData !== "undefined" && requestOptions.body instanceof FormData;
  let body = requestOptions.body;

  if (body != null && !isFormData && typeof body !== "string") {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path.startsWith("/") ? path : `/${path}`}`, {
      ...requestOptions,
      headers,
      body,
      credentials: "include",
    });
  } catch {
    throw new ApiError("No fue posible conectar con el servidor.", {
      code: "NETWORK_ERROR",
    });
  }

  if (response.status === 204) return null;

  if (responseType === "blob" && response.ok) {
    return response.blob();
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    const error = payload?.error;
    throw new ApiError(error?.message || "No fue posible completar la solicitud.", {
      status: response.status,
      code: error?.code || "REQUEST_FAILED",
      details: error?.details,
    });
  }

  return payload?.success === true ? payload.data : payload;
}

export function getHealth() {
  return apiRequest("/health");
}

export function register({ nombreCompleto, correoElectronico, contrasena }) {
  return apiRequest("/auth/registro", {
    method: "POST",
    body: { nombreCompleto, correoElectronico, contrasena },
  });
}

export function login({ correoElectronico, contrasena }) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: { correoElectronico, contrasena },
  });
}

export function getCurrentUser() {
  return apiRequest("/auth/me");
}

export function logout() {
  return apiRequest("/auth/logout", { method: "POST" });
}

export function getCategories() {
  return apiRequest("/categorias");
}

export function getLocations() {
  return apiRequest("/ubicaciones");
}

export function getReports(filters = {}) {
  const query = new URLSearchParams();
  for (const key of [
    "q",
    "categoriaId",
    "ubicacionId",
    "tipoReporte",
    "estado",
    "page",
    "limit",
  ]) {
    const value = filters[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      query.set(key, String(value).trim());
    }
  }
  if (filters.mios === true || filters.mios === "true") {
    query.set("mios", "true");
  }
  const suffix = query.size ? `?${query}` : "";
  return apiRequest(`/reportes${suffix}`);
}

export function getReport(id) {
  return apiRequest(`/reportes/${encodeURIComponent(id)}`);
}

export function createReport(formData) {
  return apiRequest("/reportes", { method: "POST", body: formData });
}

export function updateReport(id, formData) {
  return apiRequest(`/reportes/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: formData,
  });
}

export function deleteReport(id) {
  return apiRequest(`/reportes/${encodeURIComponent(id)}`, { method: "DELETE" });
}

function withPagination(path, { page = 1, limit = 20 } = {}) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit) });
  return `${path}?${query}`;
}

export function createClaim(reportId, formData) {
  return apiRequest(`/reportes/${encodeURIComponent(reportId)}/reclamaciones`, {
    method: "POST",
    body: formData,
  });
}

export function getReportClaims(reportId, pagination) {
  return apiRequest(
    withPagination(`/reportes/${encodeURIComponent(reportId)}/reclamaciones`, pagination),
  );
}

export function getMyClaims(pagination) {
  return apiRequest(withPagination("/reclamaciones/mias", pagination));
}

export function getReceivedClaims(pagination) {
  return apiRequest(withPagination("/reclamaciones/recibidas", pagination));
}

export function getClaim(id) {
  return apiRequest(`/reclamaciones/${encodeURIComponent(id)}`);
}

export function decideClaim(id, estado) {
  return apiRequest(`/reclamaciones/${encodeURIComponent(id)}/estado`, {
    method: "PATCH",
    body: { estado },
  });
}

export function getClaimEvidence(id) {
  return apiRequest(`/reclamaciones/${encodeURIComponent(id)}/evidencia`, {
    responseType: "blob",
  });
}

export function getApiAssetUrl(path) {
  if (!path) return "";
  try {
    return new URL(path, `${API_ORIGIN}/`).toString();
  } catch {
    return path;
  }
}
