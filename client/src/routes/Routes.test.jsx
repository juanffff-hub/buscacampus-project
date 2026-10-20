import { useLocation, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "../test/test-utils.jsx";
import { AuthProvider } from "../context/AuthContext.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";
import PublicOnlyRoute from "./PublicOnlyRoute.jsx";
import Login from "../pages/Login.jsx";

const { getCurrentUserMock, loginMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  loginMock: vi.fn(),
}));

vi.mock("../services/api.js", () => ({
  getCurrentUser: getCurrentUserMock,
  login: loginMock,
  register: vi.fn(),
  logout: vi.fn(),
}));

function LocationStatus() {
  const location = useLocation();
  const requested = location.state?.from;
  return (
    <div>
      <p data-testid="current-location">
        {location.pathname}{location.search}{location.hash}
      </p>
      {requested && (
        <p data-testid="requested-location">
          {requested.pathname}{requested.search}{requested.hash}
        </p>
      )}
    </div>
  );
}

function TestRoutes() {
  return (
    <>
      <LocationStatus />
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<p>Registro público</p>} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<p>Dashboard protegido</p>} />
        </Route>
      </Routes>
    </>
  );
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <TestRoutes />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("protección y restauración de rutas", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    loginMock.mockReset();
  });

  it("redirige el acceso directo al login y recupera la URL después de ingresar", async () => {
    const user = userEvent.setup();
    getCurrentUserMock.mockRejectedValue({ status: 401 });
    loginMock.mockResolvedValue({ user: { id: 5, nombreCompleto: "Ana Pérez" } });
    renderAt("/dashboard?tab=mine#reportes");

    await screen.findByLabelText("Correo institucional");
    expect(screen.getByTestId("current-location")).toHaveTextContent("/login");
    expect(screen.getByTestId("requested-location")).toHaveTextContent(
      "/dashboard?tab=mine#reportes",
    );

    await user.type(screen.getByLabelText("Correo institucional"), "ana@uao.edu.co");
    await user.type(screen.getByLabelText("Contraseña"), "clave-segura");
    await user.click(screen.getByRole("button", { name: /Ingresar/ }));

    await waitFor(() =>
      expect(screen.getByText("Dashboard protegido")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("current-location")).toHaveTextContent(
      "/dashboard?tab=mine#reportes",
    );
  });

  it("espera a que termine la restauración antes de mostrar una ruta privada", async () => {
    let resolveSession;
    getCurrentUserMock.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );
    renderAt("/dashboard");

    expect(screen.getByRole("status")).toHaveTextContent("Cargando sesión");
    resolveSession({ user: { id: 3, nombreCompleto: "Ana Pérez" } });

    await waitFor(() =>
      expect(screen.getByText("Dashboard protegido")).toBeInTheDocument(),
    );
  });

  it("redirige a dashboard cuando un usuario con sesión abre registro", async () => {
    getCurrentUserMock.mockResolvedValue({
      user: { id: 3, nombreCompleto: "Ana Pérez" },
    });
    renderAt("/register");

    await waitFor(() =>
      expect(screen.getByText("Dashboard protegido")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Registro público")).not.toBeInTheDocument();
  });
});
