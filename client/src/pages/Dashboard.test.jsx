import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  createReport,
  getApiAssetUrl,
  getCategories,
  getLocations,
  getReports,
} from "../services/api.js";

vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../services/api.js", () => ({
  createReport: vi.fn(),
  getCategories: vi.fn(),
  getApiAssetUrl: vi.fn((path) => `http://localhost:4000${path}`),
  getLocations: vi.fn(),
  getReports: vi.fn(),
}));

const ownReport = {
  id: "92",
  titulo: "Llaves del laboratorio",
  descripcion: "Perdidas cerca del bloque C.",
  tipoReporte: "Perdido",
  estado: "Publicado",
  fechaCreacion: "2026-10-20T13:00:00.000Z",
  categoria: { id: "4", nombre: "Llaves" },
  ubicacion: { id: "6", nombre: "Bloque C" },
  imagen: { url: "/uploads/92.png" },
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>,
  );
}

describe("Dashboard de reportes propios", () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ user: { nombreCompleto: "Ana Pérez" } });
    getReports.mockResolvedValue({ items: [ownReport] });
    getCategories.mockResolvedValue({ items: [{ id: "4", nombre: "Llaves" }] });
    getLocations.mockResolvedValue({ items: [{ id: "6", nombre: "Bloque C" }] });
  });

  afterEach(() => vi.clearAllMocks());

  it("consulta mios=true y muestra las tarjetas propias con imagen", async () => {
    renderDashboard();

    expect(screen.getByRole("status")).toHaveTextContent("Cargando tus reportes");
    expect(await screen.findByRole("heading", { name: "Mis reportes" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Llaves del laboratorio" })).toBeInTheDocument();
    expect(screen.getByText("Publicado por ti")).toBeInTheDocument();
    expect(screen.getByAltText("Fotografía del reporte: Llaves del laboratorio")).toHaveAttribute(
      "src",
      "http://localhost:4000/uploads/92.png",
    );
    expect(getReports).toHaveBeenCalledWith({ mios: true, page: 1, limit: 50 });
    expect(getApiAssetUrl).toHaveBeenCalledWith("/uploads/92.png");
  });

  it("muestra error y recupera el listado al reintentar", async () => {
    getReports
      .mockRejectedValueOnce(new Error("No hay conexión"))
      .mockResolvedValueOnce({ items: [ownReport] });
    renderDashboard();

    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos cargar tus reportes");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { name: "Llaves del laboratorio" })).toBeInTheDocument();
    expect(getReports).toHaveBeenCalledTimes(2);
  });

  it("invita a explorar cuando el usuario aún no tiene reportes", async () => {
    getReports.mockResolvedValue({ items: [] });
    renderDashboard();

    expect(await screen.findByRole("heading", { name: "Aún no tienes reportes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explorar reportes" })).toHaveAttribute(
      "href",
      "/#explorar",
    );
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("opens the report form and adds a created report to the dashboard", async () => {
    const newReport = {
      ...ownReport,
      id: "93",
      titulo: "Billetera verde",
      descripcion: "Encontrada junto a la biblioteca.",
    };
    createReport.mockResolvedValue({ report: newReport });
    renderDashboard();
    await screen.findByRole("heading", { name: "Llaves del laboratorio" });
    fireEvent.click(screen.getByRole("button", { name: "Publicar reporte" }));
    await screen.findByRole("heading", { name: "Publicar un reporte" });

    fireEvent.change(screen.getByLabelText("Título"), { target: { value: newReport.titulo } });
    fireEvent.change(screen.getByLabelText("Descripción"), { target: { value: newReport.descripcion } });
    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Ubicación"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Fecha y hora del evento"), { target: { value: "2026-10-21T06:00" } });
    fireEvent.change(screen.getByLabelText(/Imagen/), {
      target: { files: [new File(["image"], "wallet.png", { type: "image/png" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publicar reporte", exact: true }));

    expect(await screen.findByRole("heading", { name: "Billetera verde" })).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(createReport).toHaveBeenCalledTimes(1);
  });
});
