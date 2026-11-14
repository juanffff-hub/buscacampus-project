import { afterEach, describe, expect, it, vi } from "vitest";
import {
  apiRequest,
  createReport,
  createClaim,
  decideClaim,
  deleteReport,
  getClaim,
  getClaimEvidence,
  getMyClaims,
  getApiAssetUrl,
  getCategories,
  getLocations,
  getReportClaims,
  getReceivedClaims,
  getReports,
  updateReport,
} from "./api.js";

describe("apiRequest", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("incluye cookies y entrega los datos de la respuesta estándar", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { user: { id: 7 } } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/auth/me")).resolves.toEqual({ user: { id: 7 } });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/auth\/me$/),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("normaliza errores del contrato de API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          error: {
            code: "EMAIL_ALREADY_REGISTERED",
            message: "Ese correo ya está registrado.",
            details: [],
          },
        }),
      }),
    );

    await expect(apiRequest("/auth/registro")).rejects.toMatchObject({
      name: "ApiError",
      status: 409,
      code: "EMAIL_ALREADY_REGISTERED",
      message: "Ese correo ya está registrado.",
    });
  });
});

describe("servicios de reportes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("consume catálogos y serializa filtros de reportes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { items: [] } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getCategories();
    await getLocations();
    await getReports({
      q: " llave azul ",
      categoriaId: "4",
      ubicacionId: 3,
      tipoReporte: "Perdido",
      estado: "Publicado",
      mios: true,
      page: 2,
      limit: 12,
    });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      expect.stringMatching(/\/categorias$/),
      expect.stringMatching(/\/ubicaciones$/),
      expect.stringMatching(
        /\/reportes\?q=llave\+azul&categoriaId=4&ubicacionId=3&tipoReporte=Perdido&estado=Publicado&page=2&limit=12&mios=true$/,
      ),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("envía multipart para crear y actualizar sin fijar Content-Type", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ success: true, data: { report: { id: "91" } } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const formData = new FormData();
    formData.set("titulo", "Termo");

    await createReport(formData);
    await updateReport("91", formData);

    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({ method: "POST", body: formData }),
    );
    expect(fetchMock.mock.calls[1][1]).toEqual(
      expect.objectContaining({ method: "PUT", body: formData }),
    );
    for (const [, options] of fetchMock.mock.calls) {
      expect(options.headers.has("Content-Type")).toBe(false);
      expect(options.credentials).toBe("include");
    }
  });

  it("elimina reportes y resuelve la URL pública de sus imágenes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteReport("91")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/reportes\/91$/),
      expect.objectContaining({ method: "DELETE", credentials: "include" }),
    );
    expect(getApiAssetUrl("/uploads/91.png")).toBe(
      "http://localhost:4000/uploads/91.png",
    );
    expect(getApiAssetUrl("https://cdn.example.test/91.png")).toBe(
      "https://cdn.example.test/91.png",
    );
  });
});

describe("servicios de reclamaciones", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("crea reclamaciones multipart y pagina el historial con cookies", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ success: true, data: { reclamacion: { id: "12" } } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const formData = new FormData();
    formData.set("mensajePrueba", "Puedo describir el objeto");
    formData.set("archivo", new Blob(["evidence"], { type: "image/png" }), "evidence.png");

    await createClaim("9/1", formData);
    await getReportClaims("9/1", { page: 2, limit: 10 });
    await getMyClaims({ page: 3, limit: 5 });
    await getReceivedClaims({ page: 4, limit: 10 });

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      expect.stringMatching(/\/reportes\/9%2F1\/reclamaciones$/),
      expect.stringMatching(/\/reportes\/9%2F1\/reclamaciones\?page=2&limit=10$/),
      expect.stringMatching(/\/reclamaciones\/mias\?page=3&limit=5$/),
      expect.stringMatching(/\/reclamaciones\/recibidas\?page=4&limit=10$/),
    ]);
    expect(fetchMock.mock.calls[0][1]).toEqual(
      expect.objectContaining({ method: "POST", body: formData, credentials: "include" }),
    );
    expect(fetchMock.mock.calls[0][1].headers.has("Content-Type")).toBe(false);
    for (const [, options] of fetchMock.mock.calls) {
      expect(options.credentials).toBe("include");
    }
  });

  it("consulta el detalle, decide una reclamaciÃ³n y descarga evidencia privada como Blob", async () => {
    const evidence = new Blob(["private"], { type: "image/png" });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { reclamacion: { id: "12" } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { reclamacion: { id: "12", estado: "Aprobada" } } }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, blob: async () => evidence });
    vi.stubGlobal("fetch", fetchMock);

    await expect(getClaim("12")).resolves.toEqual({ reclamacion: { id: "12" } });
    await expect(decideClaim("12", "Aprobada")).resolves.toEqual({
      reclamacion: { id: "12", estado: "Aprobada" },
    });
    await expect(getClaimEvidence("12")).resolves.toBe(evidence);

    expect(fetchMock.mock.calls[1]).toEqual([
      expect.stringMatching(/\/reclamaciones\/12\/estado$/),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ estado: "Aprobada" }),
        credentials: "include",
      }),
    ]);
    expect(fetchMock.mock.calls[2]).toEqual([
      expect.stringMatching(/\/reclamaciones\/12\/evidencia$/),
      expect.objectContaining({ credentials: "include" }),
    ]);
  });

  it("normaliza errores JSON al solicitar evidencia privada", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          success: false,
          error: { code: "FORBIDDEN", message: "No tienes permiso.", details: [] },
        }),
      }),
    );

    await expect(getClaimEvidence("12")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
      message: "No tienes permiso.",
    });
  });
});
