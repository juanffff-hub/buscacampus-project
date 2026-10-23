import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LandingPage from "./LandingPage.jsx";
import {
  getApiAssetUrl,
  getCategories,
  getLocations,
  getReports,
} from "../services/api.js";

vi.mock("../services/api.js", () => ({
  getApiAssetUrl: vi.fn((path) => `http://localhost:4000${path}`),
  getCategories: vi.fn(),
  getLocations: vi.fn(),
  getReports: vi.fn(),
}));

const report = {
  id: "91",
  titulo: "Termo de acero",
  descripcion: "Encontrado en la biblioteca.",
  tipoReporte: "Encontrado",
  estado: "Publicado",
  fechaCreacion: "2026-10-20T16:00:00.000Z",
  categoria: { id: "2", nombre: "Otros" },
  ubicacion: { id: "10", nombre: "Biblioteca Piso 1" },
  imagen: { url: "/uploads/91.png" },
};

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe("LandingPage conectada con reportes", () => {
  beforeEach(() => {
    getCategories.mockResolvedValue({
      items: [
        { id: "2", nombre: "Otros" },
        { id: "4", nombre: "Llaves" },
      ],
    });
    getLocations.mockResolvedValue({
      items: [{ id: "10", nombre: "Biblioteca Piso 1" }],
    });
    getReports.mockResolvedValue({ items: [report] });
  });

  afterEach(() => vi.clearAllMocks());

  it("muestra reportes e imágenes reales recibidos de la API", async () => {
    renderLanding();

    expect(screen.getByRole("status")).toHaveTextContent("Cargando reportes");
    expect(await screen.findByRole("heading", { name: "Termo de acero" })).toBeInTheDocument();
    expect(screen.getByAltText("Fotografía del reporte: Termo de acero")).toHaveAttribute(
      "src",
      "http://localhost:4000/uploads/91.png",
    );
    expect(screen.getByRole("button", { name: "Llaves" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Biblioteca Piso 1" })).toHaveValue("10");
    expect(screen.queryByText(/datos de muestra/i)).not.toBeInTheDocument();
    expect(getApiAssetUrl).toHaveBeenCalledWith("/uploads/91.png");
  });

  it("envía búsqueda, categoría y ubicación como filtros del servidor", async () => {
    renderLanding();
    await screen.findByRole("heading", { name: "Termo de acero" });

    fireEvent.change(screen.getByRole("textbox", { name: "Buscar reportes" }), {
      target: { value: "llaves" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Llaves" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Filtrar por ubicación" }), {
      target: { value: "10" },
    });

    await waitFor(() => {
      expect(getReports).toHaveBeenLastCalledWith({
        q: "llaves",
        categoriaId: "4",
        ubicacionId: "10",
        page: 1,
        limit: 12,
      });
    });
  });

  it("muestra error y permite reintentar la consulta", async () => {
    getReports
      .mockRejectedValueOnce(new Error("Servidor no disponible"))
      .mockResolvedValueOnce({ items: [report] });
    renderLanding();

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar los reportes");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { name: "Termo de acero" })).toBeInTheDocument();
    expect(getReports).toHaveBeenCalledTimes(2);
  });

  it("expone estado vacío y permite limpiar los filtros", async () => {
    getReports.mockResolvedValue({ items: [] });
    renderLanding();

    expect(await screen.findByText("No encontramos objetos con esos filtros.")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar reportes" }), {
      target: { value: "objeto" },
    });
    await waitFor(() => {
      expect(getReports).toHaveBeenLastCalledWith({
        q: "objeto",
        categoriaId: "",
        ubicacionId: "",
        page: 1,
        limit: 12,
      });
    });
    await screen.findByRole("button", { name: "Limpiar filtros" });
    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));

    await waitFor(() => {
      expect(getReports).toHaveBeenLastCalledWith({
        q: "",
        categoriaId: "",
        ubicacionId: "",
        page: 1,
        limit: 12,
      });
    });
  });
});
