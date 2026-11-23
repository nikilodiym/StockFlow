import { useState } from "react";
import { Brand, Field } from "../../../shared/ui";
import { login } from "../api";

/** Login for managers and administrators. */
export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      onLogin(await login(email, password));
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Не вдалося підключитися до сервера. Перевірте з’єднання."
          : err.message,
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="login-page">
      <form
        className={`login-card ${error ? "has-error" : ""}`}
        onSubmit={submit}
      >
        <Brand large />
        <span className="admin-label">Панель адміністратора</span>
        <Field label="Email">
          <input
            autoComplete="username"
            type="email"
            placeholder="i.melnyk@warego.ua"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-invalid={!!error}
          />
        </Field>
        <Field label="Пароль">
          <input
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            aria-invalid={!!error}
          />
        </Field>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button className="button primary" disabled={loading}>
          {loading ? "Вхід…" : "Увійти"}
        </button>
        <small>Доступ лише для менеджерів складу й адміністраторів</small>
      </form>
    </div>
  );
}
