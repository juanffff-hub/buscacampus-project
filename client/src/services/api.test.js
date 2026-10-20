import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./api.js";

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
