/** Shell around every page: sidebar, top bar, load errors, progress line, toast, dialogs. */
import { useEffect, useState } from "react";
import { CircleCheck, TriangleAlert, X } from "lucide-react";
import ModalHost from "../modals/ModalHost";
import { useAdmin } from "../state/AdminProvider";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

const CLOSED = { notice: false, profile: false };

export default function AppLayout({ children }) {
  const { page, modal, loading, loadError, load, toast, say } = useAdmin();
  const [menus, setMenus] = useState(CLOSED),
    [nav, setNav] = useState(false);

  // Dropdowns and the mobile menu close on navigation, on a dialog and on Esc.
  useEffect(() => {
    setMenus(CLOSED);
    setNav(false);
  }, [page, modal]);
  useEffect(() => {
    const close = (e) => {
      if (e.key === "Escape") {
        setMenus(CLOSED);
        setNav(false);
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);

  return (
    <div className="app-shell">
      <Sidebar mobileOpen={nav} />
      {nav && <button className="nav-scrim" aria-label="Закрити меню" onClick={() => setNav(false)} />}
      <main className="main">
        <Topbar menus={menus} setMenus={setMenus} onToggleNav={() => setNav(!nav)} />
        {loadError && (
          <div className="load-error" role="alert">
            <TriangleAlert size={18} />
            <span>{loadError}</span>
            <button onClick={load}>Повторити</button>
          </div>
        )}
        {loading && !modal && <div className="loading-line" role="progressbar" aria-label="Завантаження" />}
        {children}
      </main>
      {toast && (
        <div className="toast" role="status">
          <CircleCheck size={21} />
          {toast}
          <button aria-label="Закрити повідомлення" onClick={() => say("")}>
            <X size={18} />
          </button>
        </div>
      )}
      <ModalHost />
    </div>
  );
}
