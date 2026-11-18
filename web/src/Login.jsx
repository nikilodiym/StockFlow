import { useState } from "react";
import { request } from "./api";
import { Brand, Field } from "./ui";
export default function Login({ onLogin }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const d = await request("/auth/login/", {
        auth: false,
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!d.access || !d.user) throw new Error("Неповна відповідь сервера");
      if (
        !d.user.is_staff &&
        !d.user.memberships?.some((m) => m.role === "manager")
      )
        throw new Error("Доступ лише для менеджерів складу й адміністраторів");
      localStorage.setItem("sf_token", d.access);
      localStorage.setItem("sf_refresh", d.refresh);
      localStorage.setItem("sf_user", JSON.stringify(d.user));
      onLogin(d.user);
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
