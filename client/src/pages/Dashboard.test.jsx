import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Dashboard from "./Dashboard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getApiAssetUrl, getReports } from "../services/api.js";

vi.mock("../context/AuthContext.jsx", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../services/api.js", () => ({
  getApiAssetUrl: vi.fn((path) => `http://localhost:4000${path}`),
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
});
