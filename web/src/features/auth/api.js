/** Session: login, logout and the stored tokens/profile. */
import { clearSession, request } from "../../shared/api/client";

export async function login(email, password) {
  const d = await request("/auth/login/", {
    auth: false,
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!d.access || !d.user) throw new Error("Неповна відповідь сервера");
  if (!d.user.is_staff && !d.user.memberships?.some((m) => m.role === "manager"))
    throw new Error("Доступ лише для менеджерів складу й адміністраторів");
  localStorage.setItem("sf_token", d.access);
  localStorage.setItem("sf_refresh", d.refresh);
  localStorage.setItem("sf_user", JSON.stringify(d.user));
  return d.user;
}

/** Revokes the refresh token on the server (if any) and clears the local session. */
export async function logout({ preview }) {
  if (!preview && localStorage.getItem("sf_refresh"))
    await request("/auth/logout/", {
      method: "POST",
      body: JSON.stringify({ refresh: localStorage.getItem("sf_refresh") }),
    });
  clearSession();
}
