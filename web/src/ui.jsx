import { ChevronDown, ChevronLeft, ChevronRight, Package } from "lucide-react";
export const fmt = (n) =>
  new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 }).format(
    Number(n) || 0,
  );
export const initials = (n) =>
  (n || "Користувач")
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("");
export const roleOf = (u) =>
  u?.is_staff ? "admin" : u?.role || u?.memberships?.[0]?.role || "worker";
export const dateParts = (d) => {
  if (!d) return ["—", ""];
  const v = new Date(d);
  return [
    v.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" }),
    v.toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }),
  ];
};
export function Brand({ large = false }) {
  return (
    <div className={`brand ${large ? "large" : ""}`}>
      <img src="/logo.svg" alt="" />
      <span>WareGo</span>
    </div>
  );
}
export function IconButton({ icon: Icon, label, danger = false, ...props }) {
  return (
    <button
      type="button"
      className={`icon-button ${danger ? "danger-text" : ""}`}
      aria-label={label}
      title={label}
      {...props}
    >
      <Icon size={24} strokeWidth={1.6} />
    </button>
  );
}
export function Button({ children, icon: Icon, tone = "", ...props }) {
  return (
    <button type="button" className={`button ${tone}`} {...props}>
      {Icon && <Icon size={22} strokeWidth={1.8} />}
      <span>{children}</span>
    </button>
  );
}
export function Badge({ children, tone = "green" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Tile({ children, tone = "" }) {
  return <span className={`tile ${tone}`}>{children}</span>;
}
export function Select({ children, label, ...props }) {
  return (
    <span className="select-wrap">
      <select aria-label={label} {...props}>
        {children}
      </select>
      <ChevronDown size={22} strokeWidth={1.6} />
    </span>
  );
}
export function Tabs({ items, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {items.map(([id, label]) => (
        <button
          type="button"
          role="tab"
          aria-selected={value === id}
          className={value === id ? "selected" : ""}
          key={id}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
export function Segments({ items, value, onChange }) {
  return (
    <div className="segments">
      {items.map(([id, label]) => (
        <button
          type="button"
          className={value === id ? "selected" : ""}
          onClick={() => onChange(id)}
          key={id}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
export function Empty({
  children = "Нічого не знайдено. Спробуйте змінити фільтри.",
}) {
  return (
    <div className="empty">
      <Package size={28} />
      <p>{children}</p>
    </div>
  );
}
export function Table({ headers, children, empty = false }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {empty && <Empty />}
    </div>
  );
}
export function Pagination({ total, page, onChange, size = 10 }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="pagination">
      <small>
        {total
          ? `${(page - 1) * size + 1}–${Math.min(page * size, total)} із ${total}`
          : "0 із 0"}
      </small>
      <div>
        <button
          aria-label="Попередня сторінка"
          disabled={page === 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={22} />
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
          <button
            className={page === p ? "selected" : ""}
            key={p}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ))}
        <button
          aria-label="Наступна сторінка"
          disabled={page === pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={22} />
        </button>
      </div>
    </div>
  );
}
export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
