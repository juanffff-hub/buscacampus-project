import { useLocation, Route, Routes, MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "../test/test-utils.jsx";
import { AuthProvider } from "../context/AuthContext.jsx";
import Login from "./Login.jsx";
import Register from "./Register.jsx";

const { getCurrentUserMock, loginMock, registerMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  loginMock: vi.fn(),
  registerMock: vi.fn(),
}));

vi.mock("../services/api.js", () => ({
  getCurrentUser: getCurrentUserMock,
  login: loginMock,
  register: registerMock,
  logout: vi.fn(),
}));

function LocationStatus() {
  const location = useLocation();
  return (
    <p data-testid="location-status">
      {location.pathname}
      {location.state?.message ? `: ${location.state.message}` : ""}
    </p>
  );
}

function renderAuthRoutes(initialEntry = "/login") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AuthProvider>
        <LocationStatus />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<p>Panel privado</p>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("formularios de autenticación", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset().mockRejectedValue({ status: 401 });
    loginMock.mockReset();
    registerMock.mockReset();
  });

  it("envía las credenciales y abre el panel al iniciar sesión", async () => {
    const user = userEvent.setup();
    loginMock.mockResolvedValue({
      user: { id: 4, nombreCompleto: "Ana Pérez" },
    });
    renderAuthRoutes();

    await user.type(screen.getByLabelText("Correo institucional"), "ANA@UAO.EDU.CO");
    await user.type(screen.getByLabelText("Contraseña"), "clave-segura");
    await user.click(screen.getByRole("button", { name: /Ingresar/ }));

    await waitFor(() => expect(screen.getByText("Panel privado")).toBeInTheDocument());
    expect(loginMock).toHaveBeenCalledWith({
      correoElectronico: "ana@uao.edu.co",
      contrasena: "clave-segura",
    });
  });

  it("registra con campos del contrato y muestra el acceso al login", async () => {
    const user = userEvent.setup();
    registerMock.mockResolvedValue({
      user: { id: 8, nombreCompleto: "Ana Pérez" },
    });
    renderAuthRoutes("/register");

    await user.type(screen.getByLabelText("Nombre completo"), "Ana Pérez");
    await user.type(screen.getByLabelText("Correo institucional"), "ANA@UAO.EDU.CO");
    await user.type(screen.getByLabelText("Contraseña"), "clave-segura");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "clave-segura");
    await user.click(screen.getByRole("button", { name: /Crear cuenta/ }));

    await waitFor(() =>
      expect(
        screen.getByText("/login: Cuenta creada. Ya puedes iniciar sesión."),
      ).toBeInTheDocument(),
    );
    expect(registerMock).toHaveBeenCalledWith({
      nombreCompleto: "Ana Pérez",
      correoElectronico: "ana@uao.edu.co",
      contrasena: "clave-segura",
    });
  });

  it("muestra el error del servidor cuando falla el inicio de sesión", async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValue(new Error("Correo o contraseña incorrectos."));
    renderAuthRoutes();

    await user.type(screen.getByLabelText("Correo institucional"), "ana@uao.edu.co");
    await user.type(screen.getByLabelText("Contraseña"), "clave-segura");
    await user.click(screen.getByRole("button", { name: /Ingresar/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Correo o contraseña incorrectos.",
    );
    expect(screen.getByTestId("location-status")).toHaveTextContent("/login");
  });
});
