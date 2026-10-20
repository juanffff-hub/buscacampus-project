import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "../test/test-utils.jsx";
import { AuthProvider } from "../context/AuthContext.jsx";
import Navbar from "./Navbar.jsx";

const { getCurrentUserMock, logoutMock } = vi.hoisted(() => ({
  getCurrentUserMock: vi.fn(),
  logoutMock: vi.fn(),
}));

vi.mock("../services/api.js", () => ({
  getCurrentUser: getCurrentUserMock,
  login: vi.fn(),
  register: vi.fn(),
  logout: logoutMock,
}));

function CurrentLocation() {
  const location = useLocation();
  return <p data-testid="current-location">{location.pathname}</p>;
}

function renderNavbar() {
  return render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <AuthProvider>
        <Navbar />
        <CurrentLocation />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("Navbar", () => {
  beforeEach(() => {
    getCurrentUserMock.mockReset();
    logoutMock.mockReset();
  });

  it("muestra enlaces de acceso cuando no hay sesión", async () => {
    getCurrentUserMock.mockRejectedValue({ status: 401 });
    renderNavbar();

    expect(
      await screen.findByRole("link", { name: "Iniciar sesión" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Crear cuenta/ })).toHaveAttribute(
      "href",
      "/register",
    );
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).not.toBeInTheDocument();
  });

  it("muestra el usuario y cierra sesión desde el menú móvil", async () => {
    const user = userEvent.setup();
    getCurrentUserMock.mockResolvedValue({
      user: { id: 2, nombreCompleto: "Ana Pérez", correoElectronico: "ana@uao.edu.co" },
    });
    logoutMock.mockResolvedValue(null);
    renderNavbar();

    expect(
      await screen.findByRole("link", { name: "Ana Pérez" }),
    ).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("link", { name: "Iniciar sesión" })).not.toBeInTheDocument();

    const navigation = screen.getByRole("navigation", { name: "Navegación principal" });
    await user.click(screen.getByRole("button", { name: "Abrir menú" }));
    expect(navigation).toHaveClass("nav-open");

    await user.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    await waitFor(() => expect(logoutMock).toHaveBeenCalledOnce());
    await screen.findByRole("link", { name: "Iniciar sesión" });

    expect(screen.getByTestId("current-location")).toHaveTextContent("/");
    expect(navigation).not.toHaveClass("nav-open");
  });

  it("informa un error si el servidor rechaza el cierre de sesión", async () => {
    const user = userEvent.setup();
    getCurrentUserMock.mockResolvedValue({ user: { id: 2, nombreCompleto: "Ana Pérez" } });
    logoutMock.mockRejectedValue(new Error("No fue posible conectar con el servidor."));
    renderNavbar();

    await user.click(await screen.findByRole("button", { name: "Cerrar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No fue posible conectar con el servidor.",
    );
    expect(screen.getByRole("link", { name: "Ana Pérez" })).toBeInTheDocument();
  });
});
