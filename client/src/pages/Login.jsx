import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting || !event.currentTarget.reportValidity()) return;

    const formData = new FormData(event.currentTarget);
    setError(null);
    setIsSubmitting(true);
    try {
      await login({
        correoElectronico: formData.get("email").trim().toLowerCase(),
        contrasena: formData.get("password"),
      });
      const requestedLocation = location.state?.from;
      const destination = requestedLocation?.pathname
        ? `${requestedLocation.pathname}${requestedLocation.search || ""}${requestedLocation.hash || ""}`
        : "/dashboard";
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(requestError.message || "No fue posible iniciar sesión.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-section">
      <div className="container auth-grid">
        <div className="auth-aside">
          <span className="section-kicker">BIENVENIDO DE VUELTA</span>
          <h1>
            Cada objeto tiene una historia.
            <br />
            <em>Sigamos la tuya.</em>
          </h1>
          <p>
            Inicia sesión para reportar un hallazgo, consultar tus publicaciones
            y ayudar a alguien de la comunidad.
          </p>
          <div className="auth-aside-card">
            <span>✳</span>
            <p>“Entre todos, hacemos que el campus se sienta más nuestro.”</p>
            <small>Comunidad BuscaCampus</small>
          </div>
        </div>
        <div className="auth-card">
          <span className="auth-icon">↗</span>
          <h2>Inicia sesión</h2>
          <p className="auth-subtitle">Qué bueno tenerte de vuelta.</p>
          {location.state?.message && (
            <p role="status" className="form-notice">
              {location.state.message}
            </p>
          )}
          <form onSubmit={handleSubmit}>
            <label htmlFor="login-email">Correo institucional</label>
            <input
              id="login-email"
              name="email"
              type="email"
              placeholder="nombre@uao.edu.co"
              autoComplete="email"
              pattern=".+@[Uu][Aa][Oo]\.[Ee][Dd][Uu]\.[Cc][Oo]"
              title="Usa tu correo institucional @uao.edu.co"
              required
            />
            <div className="label-row">
              <label htmlFor="login-password">Contraseña</label>
            </div>
            <div className="password-wrap">
              <input
                id="login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Tu contraseña"
                autoComplete="current-password"
                minLength="8"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <button
              className="button button-primary auth-submit"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Ingresando..." : "Ingresar"} <span aria-hidden="true">→</span>
            </button>
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
          </form>
          <p className="auth-switch">
            ¿Aún no tienes cuenta? <Link to="/register">Regístrate aquí</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
