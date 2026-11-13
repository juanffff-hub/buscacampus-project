import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ReportDetail from "./ReportDetail.jsx";
import { getApiAssetUrl, getMyClaims, getReport } from "../services/api.js";

const { getMyClaimsMock, useAuthMock } = vi.hoisted(() => ({
  getMyClaimsMock: vi.fn(),
  useAuthMock: vi.fn(),
}));

vi.mock("../services/api.js", () => ({
  getApiAssetUrl: vi.fn((path) => `http://localhost:4000${path}`),
  getMyClaims: getMyClaimsMock,
  getReport: vi.fn(),
}));

vi.mock("../context/AuthContext.jsx", () => ({ useAuth: useAuthMock }));

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
        <Route path="/login" element={<LoginDestination />} />
      </Routes>
    </MemoryRouter>,
  );
}

function LoginDestination() {
  const location = useLocation();
  return <p data-testid="login-state">{JSON.stringify(location.state)}</p>;
}

describe("detalle público del reporte", () => {
  beforeEach(() => {
    getReport.mockResolvedValue({ report });
    getMyClaimsMock.mockResolvedValue({ items: [], pagination: { totalPages: 1 } });
    useAuthMock.mockReturnValue({ isAuthenticated: false, user: null });
  });
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

  it("envía al visitante a login y conserva el regreso al detalle al reclamar", async () => {
    renderDetail();
    await screen.findByRole("heading", { name: "Termo azul" });
    fireEvent.click(screen.getByRole("link", { name: "Reclamar este objeto" }));

    expect(screen.getByTestId("login-state")).toHaveTextContent(
      JSON.stringify({
        from: { pathname: "/reportes/91" },
        message: "Inicia sesión para reclamar este objeto encontrado.",
      }),
    );
  });

  it("oculta la acción cuando la cuenta ya reclamó el reporte", async () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, user: { id: "7" } });
    getMyClaimsMock.mockResolvedValue({
      items: [{ reporte: { id: "91" } }],
      pagination: { totalPages: 1 },
    });
    renderDetail();

    expect(await screen.findByText("Ya presentaste una reclamación para este reporte."))
      .toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Reclamar este objeto" })).not.toBeInTheDocument();
  });

  it.each([
    ["autor", { id: "4", nombreCompleto: "Ana Pérez" }, "Publicado"],
    ["reporte devuelto", { id: "7", nombreCompleto: "Luis" }, "Devuelto"],
  ])("no ofrece reclamar un %s", async (reason, user, status) => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, user });
    getReport.mockResolvedValue({
      report: {
        ...report,
        estado: status,
        autor: { ...report.autor, id: "4" },
      },
    });
    renderDetail();

    await screen.findByRole("heading", { name: "Termo azul" });
    expect(screen.queryByRole("link", { name: "Reclamar este objeto" })).not.toBeInTheDocument();
    expect(getMyClaims).not.toHaveBeenCalled();
  });
});
