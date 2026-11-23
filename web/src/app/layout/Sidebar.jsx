/** Left navigation built from app/routes.js (users page only for admins). */
import { useAdmin } from "../state/AdminProvider";
import { ROUTES } from "../routes";
import { Brand } from "../../shared/ui";

export default function Sidebar({ mobileOpen }) {
  const { page, go, admin, data } = useAdmin();
  const badge = (id) =>
    (id === "documents" && data.documents.some((d) => d.status === "conflict")) ||
    (id === "users" && data.requests.length > 0);
  return (
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <Brand />
      <nav>
        {ROUTES.filter((r) => admin || !r.adminOnly).map(({ id, label, icon: Icon }) => (
          <button key={id} className={page === id ? "active" : ""} onClick={() => go(id)}>
            <Icon size={24} strokeWidth={1.6} />
            <span>{label}</span>
            {badge(id) && <span className="nav-count">1</span>}
          </button>
        ))}
      </nav>
    </aside>
  );
}
