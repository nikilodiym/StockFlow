import { useEffect, useState } from "react";
import {
  Search,
  Bell,
  ChevronDown,
  TriangleAlert,
  WifiOff,
  KeyRound,
  LogOut,
  RefreshCw,
  Menu,
  CircleCheck,
  X,
} from "lucide-react";
import useAdmin from "./useAdmin";
import Login from "./Login";
import Catalog from "./Catalog";
import Documents from "./Documents";
import Users from "./Users";
import Warehouses from "./Warehouses";
import Dashboard from "./Dashboard";
import AdminModal from "./AdminModal";
import { Brand, Select, Tile, Empty, initials, roleOf } from "./ui";
import { roles, types } from "./data";
import {
  HomeIcon,
  PackageIcon,
  DocumentIcon,
  UserIcon,
  WarehouseIcon,
  ReportsIcon,
} from "./ReferenceIcon";
const NAV = [
  ["dashboard", "Дашборд", HomeIcon],
  ["catalog", "Номенклатура", PackageIcon],
  ["documents", "Документи", DocumentIcon],
  ["users", "Користувачі", UserIcon],
  ["warehouses", "Склади", WarehouseIcon],
  ["reports", "Звіти", ReportsIcon],
];
const titles = {
  dashboard: "Дашборд",
  catalog: "Номенклатура товарів",
  documents: "Складські документи",
  users: "Користувачі",
  warehouses: "Склади",
  reports: "Аналітика та звіти",
};
export default function AdminApp() {
  const a = useAdmin(),
    {
      user,
      setUser,
      data,
      admin,
      preview,
      page,
      warehouse,
      setWarehouse,
      go,
      open,
      load,
      loading,
      loadError,
      say,
      toast,
    } = a;
  const [search, setSearch] = useState(""),
    [notice, setNotice] = useState(false),
    [profile, setProfile] = useState(false),
    [nav, setNav] = useState(false);
  useEffect(() => {
    setNotice(false);
    setProfile(false);
    setNav(false);
  }, [page, a.modal]);
  useEffect(() => {
    const close = (e) => {
      if (e.key === "Escape") {
        setNotice(false);
        setProfile(false);
        setNav(false);
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  if (!user) return <Login onLogin={setUser} />;
  const unread = data.notifications.filter((n) => !n.read_at).length;
  const results = search
    ? [
        [
          "catalog",
          data.products
            .filter((p) =>
              `${p.name} ${p.sku} ${p.barcode}`
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .slice(0, 4),
        ],
        [
          "documents",
          data.documents
            .filter((d) =>
              d.number.toLowerCase().includes(search.toLowerCase()),
            )
            .slice(0, 3),
        ],
        [
          "users",
          admin
            ? data.users
                .filter((u) =>
                  `${u.name} ${u.email}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .slice(0, 3)
            : [],
        ],
      ]
    : [];
  function notification(n) {
    setNotice(false);
    if (n.target === "conflict")
      open(
        "document",
        data.documents.find((d) => d.status === "conflict"),
      );
    else if (n.target === "requests") {
      go("users");
      a.setUserTab("requests");
    } else if (n.target === "low") {
      go("catalog");
      a.setLow(true);
    } else if (n.target === "sync") open("sync");
    else open("notification", n);
  }
  return (
    <div className="app-shell">
      <aside className={`sidebar ${nav ? "mobile-open" : ""}`}>
        <Brand />
        <nav>
          {NAV.filter(([id]) => admin || id !== "users").map(
            ([id, label, Icon]) => (
              <button
                key={id}
                className={page === id ? "active" : ""}
                onClick={() => go(id)}
              >
                <Icon size={24} strokeWidth={1.6} />
                <span>{label}</span>
                {((id === "documents" &&
                  data.documents.some((d) => d.status === "conflict")) ||
                  (id === "users" && data.requests.length > 0)) && (
                  <span className="nav-count">1</span>
                )}
              </button>
            ),
          )}
        </nav>
      </aside>
      {nav && (
        <button
          className="nav-scrim"
          aria-label="Закрити меню"
          onClick={() => setNav(false)}
        />
      )}
      <main className="main">
        <header className="topbar">
          <button
            className="mobile-menu"
            aria-label="Меню"
            onClick={() => setNav(!nav)}
          >
            <Menu />
          </button>
          <h1>{titles[page]}</h1>
          <div className="header-tools">
            <form
              className="global-search"
              onSubmit={(e) => {
                e.preventDefault();
                go("catalog");
                a.setQuery(search);
                setSearch("");
              }}
            >
              <input
                aria-label="Пошук товару, документа або людини"
                placeholder="Товар, документ або людина"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button aria-label="Шукати">
                <Search size={25} strokeWidth={1.5} />
              </button>
              {search && (
                <div className="search-results">
                  {results.flatMap(([target, rows]) =>
                    rows.map((r) => (
                      <button
                        key={target + r.id}
                        type="button"
                        onClick={() => {
                          go(target);
                          a.setQuery(r.name || r.number);
                          setSearch("");
                        }}
                      >
                        <span>{r.name || r.number}</span>
                        <small>{r.sku || r.email || types[r.type]}</small>
                      </button>
                    )),
                  )}
                  <small className="search-hint">
                    Enter — знайти у номенклатурі
                  </small>
                </div>
              )}
            </form>
            <Select
              value={warehouse}
              disabled={!admin && user.memberships?.length === 1}
              label="Склад"
              onChange={(e) => setWarehouse(e.target.value)}
            >
              <option value="">Усі склади</option>
              {data.warehouses.map((w) => (
                <option value={w.id} key={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
            <div className="notification-anchor">
              <button
                className="bell-button"
                aria-label="Сповіщення"
                aria-expanded={notice}
                onClick={() => {
                  setNotice(!notice);
                  setProfile(false);
                }}
              >
                <Bell size={25} strokeWidth={1.8} />
                {unread > 0 && <span>{unread}</span>}
              </button>
              {notice && (
                <div className="notification-menu">
                  <h2>Сповіщення</h2>
                  {data.notifications.length ? (
                    data.notifications.map((n) => {
                      const Icon =
                        n.target === "low"
                          ? TriangleAlert
                          : n.kind === "error"
                            ? WifiOff
                            : n.kind === "warning"
                              ? KeyRound
                              : TriangleAlert;
                      return (
                        <button key={n.id} onClick={() => notification(n)}>
                          <Tile tone={n.kind === "warning" ? "yellow" : "red"}>
                            <Icon size={27} />
                          </Tile>
                          <span>
                            {n.title}
                            <small>{n.body}</small>
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <Empty>Нових сповіщень немає.</Empty>
                  )}
                </div>
              )}
            </div>
            <div className="profile-anchor">
              <button
                className="profile"
                onClick={() => {
                  setProfile(!profile);
                  setNotice(false);
                }}
                aria-expanded={profile}
              >
                <span className="avatar-yellow">{initials(user.name)}</span>
                <span>
                  {user.name}
                  <small>{roles[roleOf(user)]}</small>
                </span>
                <ChevronDown size={22} />
              </button>
              {profile && (
                <div className="profile-menu">
                  {preview && <small>Режим перегляду макетів</small>}
                  <button
                    onClick={() => {
                      load();
                      setProfile(false);
                    }}
                  >
                    <RefreshCw size={18} />
                    Оновити дані
                  </button>
                  <button onClick={() => open("logout")}>
                    <LogOut size={18} />
                    Вийти з акаунта
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {loadError && (
          <div className="load-error" role="alert">
            <TriangleAlert size={18} />
            <span>{loadError}</span>
            <button onClick={load}>Повторити</button>
          </div>
        )}
        {loading && !a.modal && (
          <div
            className="loading-line"
            role="progressbar"
            aria-label="Завантаження"
          />
        )}
        {page === "dashboard" && <Dashboard a={a} />}{" "}
        {page === "catalog" && <Catalog a={a} />}{" "}
        {page === "documents" && <Documents a={a} />}{" "}
        {page === "users" && admin && <Users a={a} />}{" "}
        {page === "warehouses" && <Warehouses a={a} />}{" "}
        {page === "reports" && <Dashboard a={a} reports />}
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
      <AdminModal a={a} />
    </div>
  );
}
