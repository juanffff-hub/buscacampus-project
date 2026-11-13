import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MyClaims from "./MyClaims.jsx";
import { getClaim, getClaimEvidence, getMyClaims } from "../services/api.js";

vi.mock("../services/api.js", () => ({
  decideClaim: vi.fn(),
  getClaim: vi.fn(),
  getClaimEvidence: vi.fn(),
  getMyClaims: vi.fn(),
}));

const claim = {
  id: "12",
  fechaReclamacion: "2026-11-10T15:30:00.000Z",
  estado: "Pendiente",
  reporte: { id: "91", titulo: "Termo azul", tipoReporte: "Encontrado" },
};
const claimDetail = {
  ...claim,
  mensajePrueba: "Tiene una pequeña marca en la tapa.",
  reclamante: { id: "8", nombreCompleto: "Luis Pérez" },
  reporte: {
    ...claim.reporte,
    autor: { id: "4", nombreCompleto: "Ana Pérez" },
  },
  evidencia: { nombreOriginal: "evidencia.png", mimeType: "image/png" },
};

function renderMyClaims() {
  return render(
    <MemoryRouter initialEntries={["/reclamaciones/mias"]}>
      <MyClaims />
    </MemoryRouter>,
  );
}

describe("historial de mis reclamaciones", () => {
  beforeEach(() => {
    getMyClaims.mockResolvedValue({
      items: [claim],
      pagination: { page: 1, limit: 10, total: 11, totalPages: 2 },
    });
    getClaim.mockResolvedValue({ reclamacion: claimDetail });
    getClaimEvidence.mockResolvedValue(new Blob(["private evidence"], { type: "image/png" }));
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:private-evidence"),
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  });

  afterEach(() => {
    delete URL.createObjectURL;
    delete URL.revokeObjectURL;
    vi.clearAllMocks();
  });

  it("muestra estados, detalle e imagen privada obtenida con credenciales", async () => {
    renderMyClaims();

    expect(screen.getByRole("status")).toHaveTextContent("Cargando tus reclamaciones");
    expect(await screen.findByRole("heading", { name: "Mis reclamaciones" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Termo azul" })).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(getMyClaims).toHaveBeenCalledWith({ page: 1, limit: 10 });

    fireEvent.click(screen.getByRole("button", { name: "Ver detalle y evidencia" }));
    expect(await screen.findByText("Tiene una pequeña marca en la tapa.")).toBeInTheDocument();
    expect(getClaim).toHaveBeenCalledWith("12");
    fireEvent.click(screen.getByRole("button", { name: "Ver evidencia privada" }));

    expect(await screen.findByAltText("Evidencia privada: evidencia.png"))
      .toHaveAttribute("src", "blob:private-evidence");
    expect(screen.getByRole("link", { name: "Descargar evidencia" })).toHaveAttribute(
      "download",
      "evidencia.png",
    );
    expect(getClaimEvidence).toHaveBeenCalledWith("12");
  });

  it("cambia de página y conserva la paginación recibida por la API", async () => {
    getMyClaims
      .mockResolvedValueOnce({ items: [claim], pagination: { page: 1, totalPages: 2 } })
      .mockResolvedValueOnce({
        items: [{ ...claim, id: "13", estado: "Aprobada", reporte: { id: "92", titulo: "Llaves" } }],
        pagination: { page: 2, totalPages: 2 },
      });
    renderMyClaims();
    await screen.findByRole("heading", { name: "Termo azul" });
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(await screen.findByRole("heading", { name: "Llaves" })).toBeInTheDocument();
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
    expect(getMyClaims).toHaveBeenLastCalledWith({ page: 2, limit: 10 });
  });

  it("permite reintentar y muestra el estado vacío", async () => {
    getMyClaims
      .mockRejectedValueOnce(new Error("Sin conexión"))
      .mockResolvedValueOnce({ items: [], pagination: { page: 1, totalPages: 0 } });
    renderMyClaims();
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar tus reclamaciones");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { name: "Aún no has enviado reclamaciones" }))
      .toBeInTheDocument();
    await waitFor(() => expect(getMyClaims).toHaveBeenCalledTimes(2));
  });
});
