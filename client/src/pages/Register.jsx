import { useState } from "react";
import { Link } from "react-router-dom";

export default function Register() {
  const [submitted, setSubmitted] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const mismatch = confirm.length > 0 && confirm !== password;
  function handleSubmit(event) {
    event.preventDefault();
    if (mismatch) return;
    if (event.currentTarget.reportValidity()) setSubmitted(true);
  }

  return (
    <section className="auth-section">
      <div className="container auth-grid">
        <div className="auth-aside">
          <span className="section-kicker">ÚNETE A LA COMUNIDAD</span>
          <h1>
            Un campus donde
            <br />
            <em>todo vuelve.</em>
          </h1>
          <p>
            Crea tu cuenta para compartir reportes y ayudar a que más objetos
            encuentren a sus dueños.
          </p>
          <div className="auth-benefits">
            <span>
              <b>✓</b> Publica objetos perdidos o encontrados
            </span>
            <span>
              <b>✓</b> Mantén tus reportes organizados
            </span>
            <span>
              <b>✓</b> Conecta con la comunidad UAO
            </span>
          </div>
        </div>
        <div className="auth-card">
          <span className="auth-icon">✳</span>
          <h2>Crea tu cuenta</h2>
          <p className="auth-subtitle">Empecemos con algunos datos.</p>
          <form onSubmit={handleSubmit}>
            <label htmlFor="register-name">Nombre completo</label>
            <input
              id="register-name"
              name="name"
              placeholder="Tu nombre y apellido"
              autoComplete="name"
              minLength="3"
              required
            />
            <label htmlFor="register-email">Correo institucional</label>
            <input
              id="register-email"
              name="email"
              type="email"
              placeholder="nombre@uao.edu.co"
              autoComplete="email"
              pattern=".+@uao\.edu\.co"
              title="Usa tu correo institucional @uao.edu.co"
              required
            />
            <label htmlFor="register-role">Rol de cuenta</label>
            <input
              id="register-role"
              value="Usuario"
              readOnly
              aria-describedby="role-help"
            />
            <small id="role-help" className="field-help">
              Las cuentas administrativas se asignan internamente.
            </small>
            <label htmlFor="register-password">Contraseña</label>
            <div className="password-wrap">
              <input
                id="register-password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                minLength="8"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            <label htmlFor="register-confirm">Confirmar contraseña</label>
            <input
              id="register-confirm"
              name="confirm"
              type="password"
              placeholder="Repite tu contraseña"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={mismatch}
              aria-describedby={mismatch ? "password-error" : undefined}
              required
            />
            {mismatch && (
              <small id="password-error" className="field-error">
                Las contraseñas no coinciden.
              </small>
            )}
            <button className="button button-primary auth-submit" type="submit">
              Crear cuenta <span aria-hidden="true">→</span>
            </button>
            {submitted && (
              <p role="status" className="form-notice">
                Vista de demostración: el registro estará disponible en una
                próxima entrega.
              </p>
            )}
          </form>
          <p className="auth-switch">
            ¿Ya tienes una cuenta? <Link to="/login">Inicia sesión</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
