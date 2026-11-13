import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import App from "./App.jsx";

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));

vi.mock("./context/AuthContext.jsx", () => ({ useAuth: useAuthMock }));
vi.mock("./components/Navbar.jsx", () => ({ default: () => null }));
vi.mock("./components/Footer.jsx", () => ({ default: () => null }));
vi.mock("./pages/LandingPage.jsx", () => ({ default: () => <p>Landing pública</p> }));
vi.mock("./pages/Login.jsx", () => ({ default: () => <p>Formulario de login</p> }));
vi.mock("./pages/Register.jsx", () => ({ default: () => <p>Formulario de registro</p> }));
vi.mock("./pages/Dashboard.jsx", () => ({ default: () => <p>Dashboard privado</p> }));
vi.mock("./pages/ReportDetail.jsx", () => ({ default: () => <p>Detalle público</p> }));
vi.mock("./pages/ClaimForm.jsx", () => ({ default: () => <p>Formulario de reclamación privado</p> }));
vi.mock("./pages/MyClaims.jsx", () => ({ default: () => <p>Historial privado</p> }));
vi.mock("./pages/ReceivedClaims.jsx", () => ({ default: () => <p>Bandeja privada</p> }));

function renderApp(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("rutas del flujo de reclamaciones", () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it.each([
    ["/reportes/91/reclamar", "Formulario de reclamación privado"],
    ["/reclamaciones/mias", "Historial privado"],
    ["/reclamaciones/recibidas", "Bandeja privada"],
  ])("protege el acceso directo y la carga de %s", async (path, page) => {
    useAuthMock.mockReturnValue({ isAuthenticated: false, isLoading: false });
    const unauthenticated = renderApp(path);
    expect(await screen.findByText("Formulario de login")).toBeInTheDocument();
    unauthenticated.unmount();

    useAuthMock.mockReturnValue({ isAuthenticated: true, isLoading: false });
    renderApp(path);
    expect(await screen.findByText(page)).toBeInTheDocument();
  });

  it("mantiene el detalle del reporte como una ruta pública", async () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false, isLoading: false });
    renderApp("/reportes/91");
    expect(await screen.findByText("Detalle público")).toBeInTheDocument();
  });
});
