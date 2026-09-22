import { useState } from "react";
import { Link } from "react-router-dom";

export default function Login() {
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  function handleSubmit(event) {
    event.preventDefault();
    if (event.currentTarget.reportValidity()) setSubmitted(true);
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
          <form onSubmit={handleSubmit} noValidate={false}>
            <label htmlFor="login-email">Correo institucional</label>
            <input
              id="login-email"
              name="email"
              type="email"
              placeholder="nombre@uao.edu.co"
              autoComplete="email"
              pattern=".+@uao\.edu\.co"
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
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
            <button className="button button-primary auth-submit" type="submit">
              Ingresar <span aria-hidden="true">→</span>
            </button>
            {submitted && (
              <p role="status" className="form-notice">
                Vista de demostración: el inicio de sesión estará disponible en
                una próxima entrega.
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
