import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ReportDetail from "./ReportDetail.jsx";
import { getApiAssetUrl, getReport } from "../services/api.js";

vi.mock("../services/api.js", () => ({
  getApiAssetUrl: vi.fn((path) => `http://localhost:4000${path}`),
  getReport: vi.fn(),
}));

const report = {
  id: "91",
  titulo: "Termo azul",
  descripcion: "Encontrado junto a la biblioteca.",
  tipoReporte: "Encontrado",
  estado: "Publicado",
  fechaHoraEvento: "2026-11-10T15:30:00.000Z",
  autor: { id: "4", nombreCompleto: "Ana Pérez" },
  categoria: { id: "2", nombre: "Termos" },
  ubicacion: { id: "10", nombre: "Biblioteca Piso 1" },
  imagen: { url: "/uploads/91.png" },
};

function renderDetail(path = "/reportes/91") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reportes/:id" element={<ReportDetail />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("detalle público del reporte", () => {
  beforeEach(() => getReport.mockResolvedValue({ report }));
  afterEach(() => vi.clearAllMocks());

  it("carga y muestra los datos y la imagen reales al abrir una ruta directa", async () => {
    renderDetail();

    expect(screen.getByRole("status")).toHaveTextContent("Cargando el reporte");
    expect(await screen.findByRole("heading", { name: "Termo azul" })).toBeInTheDocument();
    expect(screen.getByText("Encontrado")).toBeInTheDocument();
    expect(screen.getByText("Publicado")).toBeInTheDocument();
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText("Biblioteca Piso 1")).toBeInTheDocument();
    expect(screen.getByAltText("Fotografía del reporte: Termo azul")).toHaveAttribute(
      "src",
      "http://localhost:4000/uploads/91.png",
    );
    expect(getReport).toHaveBeenCalledWith("91");
  });

  it("muestra error y permite reintentar la consulta del detalle", async () => {
    getReport
      .mockRejectedValueOnce(new Error("No hay conexión"))
      .mockResolvedValueOnce({ report });
    renderDetail();

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar este reporte");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { name: "Termo azul" })).toBeInTheDocument();
    expect(getReport).toHaveBeenCalledTimes(2);
  });
});
