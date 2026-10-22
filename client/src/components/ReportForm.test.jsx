import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ReportForm from "./ReportForm.jsx";
import {
  createReport,
  getApiAssetUrl,
  getCategories,
  getLocations,
  updateReport,
} from "../services/api.js";

vi.mock("../services/api.js", () => ({
  createReport: vi.fn(),
  getApiAssetUrl: vi.fn((path) => path ? `http://localhost:4000${path}` : ""),
  getCategories: vi.fn(),
  getLocations: vi.fn(),
  updateReport: vi.fn(),
}));

const createdReport = {
  id: "105",
  titulo: "Llaves azules",
  descripcion: "Encontradas en el bloque D.",
  tipoReporte: "Encontrado",
  fechaCreacion: "2026-10-21T11:00:00.000Z",
  categoria: { id: "3", nombre: "Llaves" },
  ubicacion: { id: "8", nombre: "Bloque D" },
};

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Llaves azules" } });
  fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: "Encontradas en el bloque D." } });
  fireEvent.change(screen.getByLabelText("Tipo de reporte"), { target: { value: "Encontrado" } });
  fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "3" } });
  fireEvent.change(screen.getByLabelText("Ubicación"), { target: { value: "8" } });
  fireEvent.change(screen.getByLabelText("Fecha y hora del evento"), { target: { value: "2026-10-21T06:00" } });
  const image = new File(["image bytes"], "keys.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText(/Imagen/), { target: { files: [image] } });
  return image;
}

describe("formulario para publicar reportes", () => {
  beforeEach(() => {
    getCategories.mockResolvedValue({ items: [{ id: "3", nombre: "Llaves" }] });
    getLocations.mockResolvedValue({ items: [{ id: "8", nombre: "Bloque D" }] });
    createReport.mockResolvedValue({ report: createdReport });
    updateReport.mockResolvedValue({ report: createdReport });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:report-preview"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("carga catálogos, previsualiza la imagen y envía los campos multipart", async () => {
    const onCreated = vi.fn();
    render(<ReportForm onCreated={onCreated} />);

    expect(await screen.findByRole("option", { name: "Llaves" })).toBeInTheDocument();
    const image = fillValidForm();
    expect(screen.getByAltText("Vista previa de la imagen seleccionada")).toHaveAttribute("src", "blob:report-preview");
    fireEvent.click(screen.getByRole("button", { name: "Publicar reporte" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Tu reporte se publicó correctamente");
    expect(createReport).toHaveBeenCalledTimes(1);
    const formData = createReport.mock.calls[0][0];
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get("titulo")).toBe("Llaves azules");
    expect(formData.get("descripcion")).toBe("Encontradas en el bloque D.");
    expect(formData.get("categoriaId")).toBe("3");
    expect(formData.get("ubicacionId")).toBe("8");
    expect(formData.get("tipoReporte")).toBe("Encontrado");
    expect(formData.get("fechaHoraEvento")).toBe(new Date("2026-10-21T06:00").toISOString());
    expect(formData.get("archivo")).toBe(image);
    expect(onCreated).toHaveBeenCalledWith(createdReport);
  });

  it("marca campos requeridos y no envía si falta información o imagen", async () => {
    render(<ReportForm />);
    await screen.findByRole("option", { name: "Llaves" });

    fireEvent.click(screen.getByRole("button", { name: "Publicar reporte" }));

    expect(await screen.findByText("El título debe tener entre 3 y 180 caracteres.")).toBeInTheDocument();
    expect(screen.getByText("Adjunta una imagen JPEG, PNG o WebP.")).toBeInTheDocument();
    expect(createReport).not.toHaveBeenCalled();
  });

  it("rechaza formatos no admitidos y archivos mayores de 5 MB", async () => {
    render(<ReportForm />);
    await screen.findByRole("option", { name: "Llaves" });
    const fileInput = screen.getByLabelText(/Imagen/);

    fireEvent.change(fileInput, { target: { files: [new File(["bad"], "notes.txt", { type: "text/plain" })] } });
    fillValidForm();
    fireEvent.change(fileInput, { target: { files: [new File(["bad"], "notes.txt", { type: "text/plain" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar reporte" }));
    expect(await screen.findByText("La imagen debe ser JPEG, PNG o WebP.")).toBeInTheDocument();

    fireEvent.change(fileInput, { target: { files: [new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Publicar reporte" }));
    expect(await screen.findByText("La imagen no puede superar los 5 MB.")).toBeInTheDocument();
    expect(createReport).not.toHaveBeenCalled();
  });

  it("presenta el error del servidor y permite enviar otra vez", async () => {
    createReport
      .mockRejectedValueOnce(new Error("No se pudo guardar el reporte."))
      .mockResolvedValueOnce({ report: createdReport });
    render(<ReportForm />);
    await screen.findByRole("option", { name: "Llaves" });
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Publicar reporte" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar el reporte");
    fireEvent.click(screen.getByRole("button", { name: "Publicar reporte" }));
    await waitFor(() => expect(createReport).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("status")).toHaveTextContent("Tu reporte se publicó correctamente");
  });

  it("evita envíos duplicados mientras la solicitud está pendiente", async () => {
    let resolveRequest;
    createReport.mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    render(<ReportForm />);
    await screen.findByRole("option", { name: "Llaves" });
    fillValidForm();

    const submit = screen.getByRole("button", { name: "Publicar reporte" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(createReport).toHaveBeenCalledTimes(1);
    resolveRequest({ report: createdReport });
    expect(await screen.findByRole("status")).toHaveTextContent("Tu reporte se publicó correctamente");
  });

  it("precarga un reporte y lo actualiza sin exigir una imagen nueva", async () => {
    const onSaved = vi.fn();
    render(<ReportForm report={createdReport} onSaved={onSaved} />);
    await screen.findByRole("option", { name: "Llaves" });

    expect(screen.getByLabelText("Título")).toHaveValue("Llaves azules");
    expect(screen.getByLabelText("Descripción")).toHaveValue("Encontradas en el bloque D.");
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Llaves azules corregido" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Los cambios se guardaron correctamente");
    expect(updateReport).toHaveBeenCalledTimes(1);
    expect(updateReport.mock.calls[0][0]).toBe("105");
    expect(updateReport.mock.calls[0][1].get("titulo")).toBe("Llaves azules corregido");
    expect(updateReport.mock.calls[0][1].get("archivo")).toBeNull();
    expect(onSaved).toHaveBeenCalledWith(createdReport);
  });
});
