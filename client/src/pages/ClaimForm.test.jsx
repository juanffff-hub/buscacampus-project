import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ClaimForm from "./ClaimForm.jsx";
import { createClaim, getApiAssetUrl, getReport } from "../services/api.js";

vi.mock("../services/api.js", () => ({
  createClaim: vi.fn(),
  getApiAssetUrl: vi.fn((path) => `http://localhost:4000${path}`),
  getReport: vi.fn(),
}));

const report = {
  id: "91",
  titulo: "Termo azul",
  tipoReporte: "Encontrado",
  estado: "Publicado",
  autor: { id: "4", nombreCompleto: "Ana Pérez" },
  ubicacion: { nombre: "Biblioteca Piso 1" },
  imagen: { url: "/uploads/91.png" },
};

function Destination() {
  const location = useLocation();
  return (
    <p data-testid="destination">
      {location.pathname}|{location.state?.claimNotice}
    </p>
  );
}

function renderClaimForm() {
  return render(
    <MemoryRouter initialEntries={["/reportes/91/reclamar"]}>
      <Routes>
        <Route path="/reportes/:id/reclamar" element={<ClaimForm />} />
        <Route path="/reportes/:id" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("formulario de reclamación", () => {
  let createObjectURL;
  let revokeObjectURL;

  beforeEach(() => {
    getReport.mockResolvedValue({ report });
    createClaim.mockResolvedValue({ reclamacion: { id: "12" } });
    createObjectURL = vi.fn(() => "blob:preview-evidence");
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
  });

  afterEach(() => {
    delete URL.createObjectURL;
    delete URL.revokeObjectURL;
    vi.clearAllMocks();
  });

  it("previsualiza la evidencia y envía mensaje e imagen en FormData", async () => {
    renderClaimForm();
    expect(await screen.findByRole("heading", { name: "Termo azul" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Mensaje de prueba"), {
      target: { value: "Tiene una marca pequeña en la tapa." },
    });
    const file = new File(["png bytes"], "evidencia.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Imagen de evidencia"), {
      target: { files: [file] },
    });

    expect(await screen.findByAltText("Vista previa de la evidencia seleccionada"))
      .toHaveAttribute("src", "blob:preview-evidence");
    fireEvent.submit(screen.getByRole("button", { name: "Enviar reclamación" }).closest("form"));

    await waitFor(() => expect(createClaim).toHaveBeenCalledTimes(1));
    const [reportId, formData] = createClaim.mock.calls[0];
    expect(reportId).toBe("91");
    expect(formData.get("mensajePrueba")).toBe("Tiene una marca pequeña en la tapa.");
    expect(formData.get("archivo").name).toBe("evidencia.png");
    expect(await screen.findByTestId("destination")).toHaveTextContent(
      "/reportes/91|Reclamación enviada. El autor revisará tu evidencia.",
    );
  });

  it("rechaza tipos no permitidos y archivos mayores de 5 MB antes de enviar", async () => {
    renderClaimForm();
    await screen.findByRole("heading", { name: "Termo azul" });
    const input = screen.getByLabelText("Imagen de evidencia");
    fireEvent.change(input, {
      target: { files: [new File(["text"], "evidence.txt", { type: "text/plain" })] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("JPEG, PNG o WebP");
    expect(screen.getByRole("button", { name: "Enviar reclamación" })).toBeDisabled();

    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "evidence.png", {
      type: "image/png",
    });
    fireEvent.change(input, { target: { files: [oversized] } });
    expect(screen.getByRole("alert")).toHaveTextContent("máximo 5 MB");
    expect(createClaim).not.toHaveBeenCalled();
  });

  it("valida el mínimo y el máximo del mensaje antes de enviar", async () => {
    renderClaimForm();
    await screen.findByRole("heading", { name: "Termo azul" });
    const evidence = new File(["png bytes"], "evidencia.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Imagen de evidencia"), {
      target: { files: [evidence] },
    });

    fireEvent.change(screen.getByLabelText("Mensaje de prueba"), { target: { value: "corto" } });
    fireEvent.submit(screen.getByRole("button", { name: "Enviar reclamación" }).closest("form"));
    expect(await screen.findByRole("alert")).toHaveTextContent("entre 10 y 2.000 caracteres");
    expect(createClaim).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Mensaje de prueba"), {
      target: { value: "x".repeat(2001) },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Enviar reclamación" }).closest("form"));
    expect(await screen.findByRole("alert")).toHaveTextContent("entre 10 y 2.000 caracteres");
    expect(createClaim).not.toHaveBeenCalled();
  });

  it("evita un segundo envío mientras la primera solicitud sigue pendiente", async () => {
    let finishRequest;
    createClaim.mockReturnValue(new Promise((resolve) => { finishRequest = resolve; }));
    renderClaimForm();
    await screen.findByRole("heading", { name: "Termo azul" });
    fireEvent.change(screen.getByLabelText("Mensaje de prueba"), {
      target: { value: "Tiene una marca pequeña en la tapa." },
    });
    fireEvent.change(screen.getByLabelText("Imagen de evidencia"), {
      target: { files: [new File(["png bytes"], "evidencia.png", { type: "image/png" })] },
    });
    const form = screen.getByRole("button", { name: "Enviar reclamación" }).closest("form");
    fireEvent.submit(form);
    expect(await screen.findByRole("button", { name: "Enviando reclamación…" })).toBeDisabled();
    fireEvent.submit(form);
    expect(createClaim).toHaveBeenCalledTimes(1);
    finishRequest({ reclamacion: { id: "12" } });
    expect(await screen.findByTestId("destination")).toHaveTextContent("/reportes/91|");
  });

  it("muestra errores del servidor y permite intentar de nuevo", async () => {
    createClaim.mockRejectedValueOnce(new Error("Ya reclamaste este reporte."));
    renderClaimForm();
    await screen.findByRole("heading", { name: "Termo azul" });
    fireEvent.change(screen.getByLabelText("Mensaje de prueba"), {
      target: { value: "Tiene una marca pequeña en la tapa." },
    });
    fireEvent.change(screen.getByLabelText("Imagen de evidencia"), {
      target: { files: [new File(["png bytes"], "evidencia.png", { type: "image/png" })] },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Enviar reclamación" }).closest("form"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ya reclamaste este reporte.");
    expect(screen.getByRole("button", { name: "Enviar reclamación" })).toBeEnabled();
  });
});
