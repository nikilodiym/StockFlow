const API = (import.meta.env?.VITE_API_URL || "/api").replace(/\/$/, "");
let refreshPending;
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}
async function decode(response) {
  if (response.status === 204 || response.status === 205) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      data?.detail ||
        data?.message ||
        Object.values(data || {})
          .flat()
          .filter((x) => typeof x === "string")
          .join(" ") ||
        `Помилка сервера (${response.status})`,
      response.status,
    );
  return data;
}
export async function request(path, options = {}) {
  const { auth = true, ...fetchOptions } = options;
  const send = () =>
    fetch(API + path, {
      ...fetchOptions,
      headers: {
        ...(options.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...options.headers,
        ...(auth && localStorage.getItem("sf_token")
          ? { Authorization: `Bearer ${localStorage.getItem("sf_token")}` }
          : {}),
      },
    });
  let r = await send();
  if (auth && r.status === 401 && localStorage.getItem("sf_refresh")) {
    if (!refreshPending)
      refreshPending = fetch(API + "/auth/refresh/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: localStorage.getItem("sf_refresh") }),
      })
        .then(decode)
        .then((d) => {
          localStorage.setItem("sf_token", d.access);
          if (d.refresh) localStorage.setItem("sf_refresh", d.refresh);
        })
        .finally(() => {
          refreshPending = null;
        });
    try {
      await refreshPending;
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        clearSession();
        throw new ApiError("Сесія завершилась. Увійдіть повторно.", 401);
      }
      throw error;
    }
    r = await send();
  }
  return decode(r);
}
export async function getAll(path) {
  let rows = [],
    next = path;
  while (next) {
    const data = await request(next);
    if (Array.isArray(data)) return rows.concat(data);
    rows.push(...(data.results || []));
    if (data.next) {
      const u = new URL(data.next, location.origin);
      const apiPath = new URL(API, location.origin).pathname;
      next = u.pathname.slice(apiPath.length) + u.search;
    } else next = null;
  }
  return rows;
}
export function clearSession() {
  ["sf_token", "sf_refresh", "sf_user"].forEach((k) =>
    localStorage.removeItem(k),
  );
}
export function exportCSV(filename, headers, rows) {
  const cell = (x) => '"' + String(x ?? "").replaceAll('"', '""') + '"';
  const blob = new Blob(
    [
      "\uFEFF" +
        [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n"),
    ],
    { type: "text/csv;charset=utf-8;" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
