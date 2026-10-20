import { useAuth, AuthProvider } from "./AuthContext.jsx";
import { render, screen, waitFor } from "../test/test-utils.jsx";
import { describe, expect, it, vi } from "vitest";

function AuthStatus() {
  const { user, isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <p>Cargando sesión</p>;
  return <p>{isAuthenticated ? `Sesión: ${user.nombreCompleto}` : "Sin sesión"}</p>;
}

describe("AuthProvider", () => {
  it("restaura el usuario consultando la sesión existente", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { user: { id: 1, nombreCompleto: "Ana Pérez" } },
        }),
      }),
    );

    render(
      <AuthProvider>
        <AuthStatus />
      </AuthProvider>,
    );

    expect(screen.getByText("Cargando sesión")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("Sesión: Ana Pérez")).toBeInTheDocument(),
    );
  });
});
