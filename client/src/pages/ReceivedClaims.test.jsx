import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ReceivedClaims from "./ReceivedClaims.jsx";
import {
  decideClaim,
  getClaim,
  getClaimEvidence,
  getReportClaims,
  getReports,
} from "../services/api.js";

vi.mock("../services/api.js", () => ({
  decideClaim: vi.fn(),
  getClaim: vi.fn(),
  getClaimEvidence: vi.fn(),
  getReportClaims: vi.fn(),
  getReports: vi.fn(),
}));

const report = { id: "91", tipoReporte: "Encontrado" };
const claim = {
  id: "12",
  estado: "Pendiente",
  fechaReclamacion: "2026-11-11T18:30:00.000Z",
  reclamante: { id: "8", nombreCompleto: "Luis Pérez" },
  reporte: { id: "91", titulo: "Termo azul", tipoReporte: "Encontrado", estado: "En reclamación" },
};

function renderReceivedClaims() {
  return render(
    <MemoryRouter initialEntries={["/reclamaciones/recibidas"]}>
      <ReceivedClaims />
    </MemoryRouter>,
  );
}

describe("bandeja de reclamaciones recibidas", () => {
  beforeEach(() => {
    getReports.mockResolvedValue({ items: [report], pagination: { totalPages: 1 } });
    getReportClaims.mockResolvedValue({ items: [claim], pagination: { totalPages: 1 } });
    getClaim.mockResolvedValue({
      reclamacion: {
        ...claim,
        mensajePrueba: "Tiene una marca pequeña en la tapa.",
        evidencia: { nombreOriginal: "evidencia.png", mimeType: "image/png" },
      },
    });
    getClaimEvidence.mockResolvedValue(new Blob(["private"], { type: "image/png" }));
    decideClaim.mockResolvedValue({ reclamacion: { ...claim, estado: "Aprobada" } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    delete URL.createObjectURL;
    delete URL.revokeObjectURL;
  });

  it("carga reclamaciones de hallazgos propios, muestra detalles privados y evidencia", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:received-evidence"),
    });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    renderReceivedClaims();

    expect(screen.getByRole("status")).toHaveTextContent("Cargando reclamaciones recibidas");
    expect(await screen.findByRole("heading", { name: "Reclamaciones recibidas" })).toBeInTheDocument();
    expect(await screen.findByText("Reclamado por Luis Pérez")).toBeInTheDocument();
    expect(getReports).toHaveBeenCalledWith({ mios: true, page: 1, limit: 100 });
    expect(getReportClaims).toHaveBeenCalledWith("91", { page: 1, limit: 100 });

    fireEvent.click(screen.getByRole("button", { name: "Ver mensaje y evidencia" }));
    expect(await screen.findByText("Tiene una marca pequeña en la tapa.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver evidencia privada" }));
    expect(await screen.findByAltText("Evidencia privada: evidencia.png"))
      .toHaveAttribute("src", "blob:received-evidence");
    expect(getClaimEvidence).toHaveBeenCalledWith("12");
  });

  it("confirma la aprobación y actualiza la solicitud tras la decisión", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    getReportClaims
      .mockResolvedValueOnce({ items: [claim], pagination: { totalPages: 1 } })
      .mockResolvedValueOnce({
        items: [{ ...claim, estado: "Aprobada", reporte: { ...claim.reporte, estado: "Devuelto" } }],
        pagination: { totalPages: 1 },
      });
    renderReceivedClaims();
    await screen.findByText("Reclamado por Luis Pérez");
    fireEvent.click(screen.getByRole("button", { name: "Aprobar devolución" }));

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(decideClaim).toHaveBeenCalledWith("12", "Aprobada");
    expect(await screen.findByRole("status")).toHaveTextContent("Reclamación aprobada y reporte actualizado");
    await waitFor(() => expect(getReportClaims).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Aprobada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Aprobar devolución" })).not.toBeInTheDocument();
  });

  it("no permite decidir otra vez sin confirmación y reintenta una consulta fallida", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    getReports
      .mockRejectedValueOnce(new Error("Sin conexión"))
      .mockResolvedValueOnce({ items: [], pagination: { totalPages: 1 } });
    renderReceivedClaims();

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar las reclamaciones recibidas");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { name: "No tienes reclamaciones pendientes ni historial recibido" }))
      .toBeInTheDocument();
    expect(getReportClaims).not.toHaveBeenCalled();
    expect(decideClaim).not.toHaveBeenCalled();
  });
});
