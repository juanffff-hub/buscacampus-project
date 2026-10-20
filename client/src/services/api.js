const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000/api/v1")
  .replace(/\/+$/, "");

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
  const headers = new Headers(options.headers || {});
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  let body = options.body;

  if (body != null && !isFormData && typeof body !== "string") {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path.startsWith("/") ? path : `/${path}`}`, {
      ...options,
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
