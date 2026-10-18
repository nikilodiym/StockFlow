import { useCallback, useEffect, useMemo, useState } from "react";
import {
    Area,
    AreaChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {
    LayoutDashboard,
    Boxes,
    ClipboardList,
    Users,
    Warehouse,
    Settings,
    Search,
    Bell,
    Plus,
    ArrowUpRight,
    ArrowDownRight,
    MoreHorizontal,
    Package,
    RefreshCw,
    Download,
    Filter,
    ChevronDown,
    AlertTriangle,
    CheckCircle2,
    Menu,
    X,
    LogOut,
} from "lucide-react";

const API = (
    import.meta.env.VITE_API_URL || "http://localhost:8000/api"
).replace(/\/$/, "");

const STORAGE = {
    access: "sf_token",
    refresh: "sf_refresh",
    user: "sf_user",
};

const SEED_PRODUCTS = [
    {
        id: 1,
        sku: "DRK-001",
        barcode: "4820000000011",
        name: "Вода мінеральна 1.5 л",
        category: "Напої",
        unit: "шт",
        stock: 128,
        min_stock: 24,
        price: 22.5,
    },
    {
        id: 2,
        sku: "DRK-002",
        barcode: "4820000000012",
        name: "Сік апельсиновий 1 л",
        category: "Напої",
        unit: "шт",
        stock: 42,
        min_stock: 18,
        price: 58,
    },
    {
        id: 3,
        sku: "FOO-001",
        barcode: "4820000000013",
        name: "Кава зернова 1 кг",
        category: "Бакалія",
        unit: "упак",
        stock: 18,
        min_stock: 8,
        price: 349,
    },
    {
        id: 4,
        sku: "FOO-002",
        barcode: "4820000000014",
        name: "Рис довгозернистий 1 кг",
        category: "Бакалія",
        unit: "упак",
        stock: 7,
        min_stock: 12,
        price: 64.9,
    },
    {
        id: 5,
        sku: "HOM-001",
        barcode: "4820000000015",
        name: "Рушники паперові 2 шт",
        category: "Господарчі товари",
        unit: "упак",
        stock: 34,
        min_stock: 10,
        price: 42,
    },
];

const CHART_DATA = [
    { day: "Пн", incoming: 420, outgoing: 280 },
    { day: "Вт", incoming: 380, outgoing: 320 },
    { day: "Ср", incoming: 560, outgoing: 390 },
    { day: "Чт", incoming: 490, outgoing: 310 },
    { day: "Пт", incoming: 690, outgoing: 470 },
    { day: "Сб", incoming: 520, outgoing: 350 },
    { day: "Нд", incoming: 610, outgoing: 420 },
];

const NAVIGATION = [
    ["Огляд", LayoutDashboard],
    ["Номенклатура", Boxes],
    ["Документи", ClipboardList],
    ["Склади", Warehouse],
    ["Команда", Users],
    ["Аналітика", ChartIcon],
    ["Налаштування", Settings],
];

const DOCUMENT_TYPES = {
    receipt: {
        title: "Прихід товарів",
        description: "Оприбуткувати нову поставку",
        Icon: ArrowDownRight,
    },
    writeoff: {
        title: "Списання",
        description: "Зафіксувати списання товару",
        Icon: ArrowUpRight,
    },
    inventory: {
        title: "Інвентаризація",
        description: "Звірити фактичні залишки",
        Icon: ClipboardList,
    },
    transfer: {
        title: "Переміщення",
        description: "Перемістити між складами",
        Icon: Warehouse,
    },
};

const ROLES = {
    worker: "Комірник",
    manager: "Менеджер складу",
    admin: "Адміністратор",
};

function readUser() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE.user) || "null");
    } catch {
        return null;
    }
}

function getErrorMessage(error) {
    return error instanceof Error
        ? error.message
        : "Сталася невідома помилка";
}

// DRF повертає помилки валідації як { поле: ["повідомлення"] }.
function formatFieldErrors(data) {
    if (!data || typeof data !== "object") return "";

    return Object.values(data)
        .flat()
        .filter((value) => typeof value === "string")
        .join(" ");
}

export default function App() {
    const [token, setToken] = useState(
        () => localStorage.getItem(STORAGE.access) || "",
    );
    const [user, setUser] = useState(readUser);
    const [page, setPage] = useState("Огляд");
    const [products, setProducts] = useState(SEED_PRODUCTS);
    const [docs, setDocs] = useState([]);
    const [offline, setOffline] = useState(!navigator.onLine);
    const [query, setQuery] = useState("");
    const [modal, setModal] = useState("");
    const [toast, setToast] = useState("");
    const [loginError, setLoginError] = useState("");
    const [form, setForm] = useState({});
    const [loading, setLoading] = useState(false);
    const [side, setSide] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [team, setTeam] = useState([]);
    const [warehouses, setWarehouses] = useState([]);
    const [teamLoading, setTeamLoading] = useState(false);

    const say = useCallback((message) => {
        setToast(message);
    }, []);

    useEffect(() => {
        if (!toast) return undefined;

        const timer = setTimeout(() => setToast(""), 2800);

        return () => clearTimeout(timer);
    }, [toast]);

    useEffect(() => {
        const handleOnline = () => setOffline(false);
        const handleOffline = () => setOffline(true);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem(STORAGE.access);
        localStorage.removeItem(STORAGE.refresh);
        localStorage.removeItem(STORAGE.user);

        setToken("");
        setUser(null);
    }, []);

    const req = useCallback(
        async (path, options = {}) => {
            const sendRequest = (accessToken) =>
                fetch(`${API}${path}`, {
                    ...options,
                    headers: {
                        "Content-Type": "application/json",
                        ...options.headers,
                        ...(accessToken
                            ? { Authorization: `Bearer ${accessToken}` }
                            : {}),
                    },
                });

            let response = await sendRequest(token);

            if (response.status === 401) {
                const refresh = localStorage.getItem(STORAGE.refresh);

                if (!refresh) {
                    logout();
                    throw new Error("Сесія завершилась. Увійдіть повторно.");
                }

                let refreshResponse;

                try {
                    refreshResponse = await fetch(`${API}/auth/refresh/`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({ refresh }),
                    });
                } catch {
                    throw new Error("Не вдалося підключитися до сервера.");
                }

                if (!refreshResponse.ok) {
                    logout();
                    throw new Error("Сесія завершилась. Увійдіть повторно.");
                }

                const refreshed = await refreshResponse.json();

                if (!refreshed.access) {
                    logout();
                    throw new Error("Сервер не повернув новий токен.");
                }

                localStorage.setItem(STORAGE.access, refreshed.access);

                if (refreshed.refresh) {
                    localStorage.setItem(STORAGE.refresh, refreshed.refresh);
                }

                setToken(refreshed.access);
                response = await sendRequest(refreshed.access);
            }

            if (!response.ok) {
                let message = "Помилка запиту до API";

                try {
                    const data = await response.json();
                    message =
                        data.detail ||
                        data.message ||
                        formatFieldErrors(data) ||
                        message;
                } catch {
                    // Відповідь сервера не містить JSON.
                }

                throw new Error(message);
            }

            if (response.status === 204) return null;

            return response.json();
        },
        [token, logout],
    );

    const sync = useCallback(async () => {
        if (!token || offline || syncing) return;

        setSyncing(true);

        try {
            const [productData, documentData] = await Promise.all([
                req("/products/?ordering=name"),
                req("/documents/"),
            ]);

            const nextProducts = productData.results ?? productData;
            const nextDocs = documentData.results ?? documentData;

            if (!Array.isArray(nextProducts) || !Array.isArray(nextDocs)) {
                throw new Error("Сервер повернув дані в неправильному форматі.");
            }

            setProducts(nextProducts);
            setDocs(nextDocs);
        } catch (error) {
            say(getErrorMessage(error));
        } finally {
            setSyncing(false);
        }
    }, [token, offline, syncing, req, say]);

    useEffect(() => {
        if (!token || offline) return;

        let cancelled = false;

        const loadData = async () => {
            try {
                const [productData, documentData] = await Promise.all([
                    req("/products/?ordering=name"),
                    req("/documents/"),
                ]);

                if (cancelled) return;

                const nextProducts = productData.results ?? productData;
                const nextDocs = documentData.results ?? documentData;

                if (Array.isArray(nextProducts)) setProducts(nextProducts);
                if (Array.isArray(nextDocs)) setDocs(nextDocs);
            } catch (error) {
                if (!cancelled) say(getErrorMessage(error));
            }
        };

        loadData();

        return () => {
            cancelled = true;
        };
    }, [token, offline, req, say]);

    const loadTeam = useCallback(async () => {
        setTeamLoading(true);

        try {
            const [userData, warehouseData] = await Promise.all([
                req("/users/"),
                req("/warehouses/"),
            ]);

            setTeam(userData.results ?? userData);
            setWarehouses(warehouseData.results ?? warehouseData);
        } catch (error) {
            say(getErrorMessage(error));
        } finally {
            setTeamLoading(false);
        }
    }, [req, say]);

    useEffect(() => {
        if (token && !offline && page === "Команда") loadTeam();
    }, [token, offline, page, loadTeam]);


    const login = async e => {
        e.preventDefault();
        setLoading(true);

        try {
            say('Відправляємо запит на сервер...');

            const r = await fetch(API + '/auth/login/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: form.email,
                    password: form.password
                })
            });

            const d = await r.json();

            if (!r.ok) {
                throw new Error(
                    `HTTP ${r.status}: ${JSON.stringify(d)}`
                );
            }

            localStorage.setItem('sf_token', d.access);
            localStorage.setItem('sf_refresh', d.refresh);
            localStorage.setItem('sf_user', JSON.stringify(d.user));

            setToken(d.access);
            setUser(d.user);
            say('Вітаємо у StockFlow');
        } catch (error) {
            say(`Помилка: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };


    const low = useMemo(
        () =>
            products.filter(
                (product) => Number(product.stock) <= Number(product.min_stock),
            ),
        [products],
    );

    const filtered = useMemo(() => {
        const search = query.trim().toLowerCase();

        return products.filter((product) =>
            `${product.name} ${product.sku} ${product.barcode || ""}`
                .toLowerCase()
                .includes(search),
        );
    }, [products, query]);

    const totalValue = useMemo(
        () =>
            products.reduce(
                (total, product) =>
                    total + Number(product.stock) * Number(product.price),
                0,
            ),
        [products],
    );

    const totalStock = useMemo(
        () =>
            products.reduce(
                (total, product) => total + Number(product.stock),
                0,
            ),
        [products],
    );

    const updateForm = (field, value) => {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
    };

    const newProduct = () => {
        setForm({
            name: "",
            sku: "",
            barcode: "",
            category: "Напої",
            unit: "шт",
            stock: 0,
            min_stock: 5,
            price: 0,
        });

        setModal("product");
    };

    const saveProduct = async (event) => {
        event.preventDefault();

        const product = {
            ...form,
            stock: Number(form.stock),
            min_stock: Number(form.min_stock),
            price: Number(form.price),
        };

        try {
            const saved = await req("/products/", {
                method: "POST",
                body: JSON.stringify(product),
            });

            setProducts((current) => [saved, ...current]);
            say("Товар збережено на сервері");
        } catch (error) {
            say(`Не вдалося зберегти товар: ${getErrorMessage(error)}`);
            return;
        }

        setModal("");
    };

    const newUser = () => {
        setForm({
            name: "",
            email: "",
            password: "",
            role: "worker",
            warehouse: warehouses[0]?.id ?? "",
        });

        setModal("user");
    };

    const saveUser = async (event) => {
        event.preventDefault();

        try {
            const saved = await req("/users/", {
                method: "POST",
                body: JSON.stringify({
                    ...form,
                    warehouse: Number(form.warehouse),
                }),
            });

            setTeam((current) => [saved, ...current]);
            say(`Акаунт ${saved.email} створено`);
        } catch (error) {
            say(`Не вдалося створити акаунт: ${getErrorMessage(error)}`);
            return;
        }

        setModal("");
    };

    const updateMember = async (member, changes, message) => {
        try {
            const saved = await req(`/users/${member.id}/`, {
                method: "PATCH",
                body: JSON.stringify(changes),
            });

            setTeam((current) =>
                current.map((item) => (item.id === saved.id ? saved : item)),
            );
            say(message);
        } catch (error) {
            say(`Не вдалося оновити користувача: ${getErrorMessage(error)}`);
        }
    };

    const newDoc = async (type) => {
        const document = {
            type,
            status: "draft",
            warehouse: 1,
            note: "Створено в StockFlow",
            lines: [],
        };

        try {
            const saved = await req("/documents/", {
                method: "POST",
                body: JSON.stringify(document),
            });

            setDocs((current) => [saved, ...current]);
            say("Чернетку створено на сервері");
        } catch (error) {
            say(`Не вдалося створити документ: ${getErrorMessage(error)}`);
            return;
        }

        setModal("");
    };

    const refreshData = async () => {
        await sync();
        say("Оновлення завершено");
    };

    if (!token) {
        return (
            <div className="login">
                <div className="hero">
                    <Brand />

                    <div className="hero-copy">
                        <div className="eyebrow">
                            <i />
                            СИСТЕМА СКЛАДСЬКОГО ОБЛІКУ
                        </div>

                        <h1>
                            Весь склад.
                            <br />
                            <em>Під контролем.</em>
                        </h1>

                        <p>
                            Рух товарів, залишки й команда —
                            <br />
                            в одному спокійному просторі.
                        </p>

                        <div className="hero-stats">
                            <b>
                                24/7
                                <small>синхронізація</small>
                            </b>
                            <b>
                                −38%
                                <small>помилок обліку</small>
                            </b>
                            <b>
                                10k+
                                <small>товарів</small>
                            </b>
                        </div>
                    </div>

                    <small className="hero-foot">
                        © 2026 STOCKFLOW SYSTEMS
                    </small>
                </div>

                <div className="login-side">
                    <div className="login-box">
                        <div className="eyebrow muted">АДМІН-ПАНЕЛЬ</div>
                        <h2>Раді вас бачити</h2>
                        <p>Увійдіть, щоб перейти до свого складу.</p>

                        <form onSubmit={login}>
                            <label>
                                Робочий email
                                <input
                                    required
                                    type="email"
                                    placeholder="name@company.com"
                                    value={form.email || ""}
                                    onChange={(event) =>
                                        updateForm("email", event.target.value)
                                    }
                                />
                            </label>

                            <label>
                                Пароль
                                <input
                                    required
                                    type="password"
                                    placeholder="Введіть пароль"
                                    value={form.password || ""}
                                    onChange={(event) =>
                                        updateForm("password", event.target.value)
                                    }
                                />
                            </label>


                            {loginError && (
                                <p className="login-error" role="alert">
                                    {loginError}
                                </p>
                            )}

                            <button
                                type="submit"
                                className="primary full"
                                disabled={loading}
                                aria-busy={loading}
                            >
                                {loading ? "Входимо…" : "Увійти до системи"}
                                <ArrowUpRight size={17} />
                            </button>

                        </form>

                        <div className="secure">
                            ⌑ &nbsp;Ваше з’єднання захищено
                        </div>

                        <small className="demo">
                            Демо: admin@gmail.com · admin
                        </small>
                    </div>

                    <small className="login-bottom">
                        Потрібна допомога? Зв’яжіться з підтримкою
                    </small>
                </div>

                {toast && <Toast text={toast} />}
            </div>
        );
    }

    return (
        <div className="shell">
            <aside className={`sidebar ${side ? "open" : ""}`}>
                <div className="brand-row">
                    <Brand />
                    <button
                        className="close"
                        onClick={() => setSide(false)}
                        aria-label="Закрити меню"
                    >
                        <X />
                    </button>
                </div>

                <button className="warehouse-switch">
                    <span className="wh-icon">
                        <Warehouse size={17} />
                    </span>
                    <span>
                        <b>Центральний склад</b>
                        <small>Київ · KYIV-01</small>
                    </span>
                    <ChevronDown size={15} />
                </button>

                <div className="nav-label">РОБОЧИЙ ПРОСТІР</div>

                {NAVIGATION.slice(0, 5).map(([name, Icon]) => (
                    <button
                        className={`nav ${page === name ? "selected" : ""}`}
                        onClick={() => {
                            setPage(name);
                            setSide(false);
                        }}
                        key={name}
                    >
                        <Icon size={18} />
                        {name}
                        {name === "Номенклатура" && <small>{products.length}</small>}
                    </button>
                ))}

                <div className="nav-label manager">КЕРУВАННЯ</div>

                {NAVIGATION.slice(5).map(([name, Icon]) => (
                    <button
                        className={`nav ${page === name ? "selected" : ""}`}
                        onClick={() => {
                            setPage(name);
                            setSide(false);
                        }}
                        key={name}
                    >
                        <Icon size={18} />
                        {name}
                    </button>
                ))}

                <div className="grow" />

                <div className="sync-card">
                    <div>
                        <i className={offline ? "off" : ""} />
                        <b>{offline ? "Немає з’єднання" : "Стан синхронізації"}</b>
                    </div>

                    <small>
                        {offline
                            ? "Зміни не надсилаються на сервер"
                            : "Перевірте актуальність даних"}
                    </small>

                    <button onClick={refreshData} disabled={syncing || offline}>
                        <RefreshCw size={14} />
                        {syncing ? "Синхронізація…" : "Синхронізувати"}
                    </button>
                </div>

                <button className="profile" onClick={logout}>
                    <span className="avatar">
                        {(user?.name || user?.email || "О").slice(0, 1).toUpperCase()}
                    </span>
                    <span>
                        <b>{user?.name || user?.email || "Користувач"}</b>
                        <small>Адміністратор</small>
                    </span>
                    <LogOut size={16} />
                </button>
            </aside>

            <main>
                <header className="topbar">
                    <button
                        className="hamb"
                        onClick={() => setSide(true)}
                        aria-label="Відкрити меню"
                    >
                        <Menu />
                    </button>

                    <div>
                        Склад <span>/</span> <b>{page}</b>
                    </div>

                    <section>
                        <span className={`network ${offline ? "off" : ""}`}>
                            <i />
                            {offline ? "Офлайн" : "Онлайн"}
                        </span>

                        <button
                            className="bell"
                            onClick={() => say("Нових сповіщень немає")}
                            aria-label="Сповіщення"
                        >
                            <Bell size={18} />
                            <i />
                        </button>

                        <span className="vertical" />

                        <button className="avatar" onClick={logout}>
                            {(user?.name || user?.email || "О").slice(0, 1).toUpperCase()}
                        </button>
                    </section>
                </header>

                <div className="content">
                    <div className="heading">
                        <div>
                            <div className="eyebrow muted">
                                СКЛАД · KYIV-01
                            </div>

                            <h1>
                                {page === "Огляд"
                                    ? `Доброго дня, ${user?.name || "користувачу"}`
                                    : page}
                            </h1>

                            <p>
                                {page === "Огляд"
                                    ? "Ось що відбувається на складі сьогодні."
                                    : "Керуйте складськими операціями та даними в одному місці."}
                            </p>
                        </div>

                        <div>
                            <button
                                className="secondary"
                                onClick={refreshData}
                                disabled={syncing || offline}
                            >
                                <RefreshCw size={15} />
                                Оновити
                            </button>

                            <button
                                className="primary"
                                onClick={() => setModal("doc")}
                            >
                                <Plus size={17} />
                                Новий документ
                            </button>
                        </div>
                    </div>

                    {page === "Огляд" || page === "Аналітика" ? (
                        <>
                            <div className="metrics">
                                <Metric
                                    icon={Package}
                                    label="Вартість запасів"
                                    value={`₴${totalValue.toLocaleString("uk-UA", {
                                        maximumFractionDigits: 0,
                                    })}`}
                                    delta="Поточна"
                                    hint="вартість товарів"
                                    color="mint"
                                />

                                <Metric
                                    icon={Boxes}
                                    label="Активні SKU"
                                    value={products.length}
                                    delta="Усього"
                                    hint="позицій у каталозі"
                                    color="blue"
                                />

                                <Metric
                                    icon={AlertTriangle}
                                    label="Потрібна увага"
                                    value={low.length}
                                    delta={String(low.length)}
                                    hint="позицій із низьким запасом"
                                    color="amber"
                                />

                                <Metric
                                    icon={ClipboardList}
                                    label="Документи"
                                    value={docs.length}
                                    delta="Усього"
                                    hint="у системі"
                                    color="violet"
                                />
                            </div>

                            <div className="dash-grid">
                                <div className="panel movement">
                                    <div className="panel-head">
                                        <div>
                                            <h3>Рух товарів</h3>
                                            <p>Прихід і списання за поточний тиждень</p>
                                        </div>

                                        <button className="select">
                                            Цей тиждень <ChevronDown size={14} />
                                        </button>
                                    </div>

                                    <div className="legend">
                                        <span>● Прихід</span>
                                        <span>● Списання</span>
                                    </div>

                                    <div className="chart">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart
                                                data={CHART_DATA}
                                                margin={{
                                                    top: 10,
                                                    right: 5,
                                                    left: -22,
                                                    bottom: 0,
                                                }}
                                            >
                                                <defs>
                                                    <linearGradient
                                                        id="stockFlowGradient"
                                                        x1="0"
                                                        y1="0"
                                                        x2="0"
                                                        y2="1"
                                                    >
                                                        <stop
                                                            offset="0%"
                                                            stopColor="#3e9b78"
                                                            stopOpacity={0.18}
                                                        />
                                                        <stop
                                                            offset="95%"
                                                            stopColor="#3e9b78"
                                                            stopOpacity={0}
                                                        />
                                                    </linearGradient>
                                                </defs>

                                                <XAxis
                                                    dataKey="day"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: "#999", fontSize: 11 }}
                                                    dy={8}
                                                />

                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: "#aaa", fontSize: 10 }}
                                                />

                                                <Tooltip />

                                                <Area
                                                    dataKey="incoming"
                                                    name="Прихід"
                                                    type="monotone"
                                                    stroke="#3e9b78"
                                                    strokeWidth={2.5}
                                                    fill="url(#stockFlowGradient)"
                                                />

                                                <Area
                                                    dataKey="outgoing"
                                                    name="Списання"
                                                    type="monotone"
                                                    stroke="#a6b9ad"
                                                    strokeWidth={2}
                                                    fill="transparent"
                                                    strokeDasharray="5 5"
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>

                                    <div className="chart-foot">
                                        Демонстраційні дані
                                        <button onClick={() => setPage("Аналітика")}>
                                            Уся аналітика <ArrowUpRight size={14} />
                                        </button>
                                    </div>
                                </div>

                                <div className="panel stock">
                                    <div className="panel-head">
                                        <div>
                                            <h3>Рівень запасів</h3>
                                            <p>Структура за категоріями</p>
                                        </div>
                                        <MoreHorizontal />
                                    </div>

                                    <div className="stock-total">
                                        <b>{totalStock.toLocaleString("uk-UA")}</b>
                                        <span>одиниць на складі</span>
                                    </div>

                                    {[
                                        ["Бакалія", "green"],
                                        ["Напої", "blue"],
                                        ["Господарчі товари", "amber"],
                                        ["Інше", "slate"],
                                    ].map(([category, color]) => {
                                        const quantity = products
                                            .filter((product) => product.category === category)
                                            .reduce(
                                                (sum, product) => sum + Number(product.stock),
                                                0,
                                            );

                                        const percentage =
                                            totalStock > 0 ? (quantity / totalStock) * 100 : 0;

                                        return (
                                            <div className="bar-row" key={category}>
                                                <div>
                                                    <span>{category}</span>
                                                    <b>{quantity.toLocaleString("uk-UA")}</b>
                                                </div>

                                                <div className="bar">
                                                    <i
                                                        className={color}
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <div className="stock-foot">
                                        Запаси за даними каталогу
                                    </div>
                                </div>
                            </div>

                            <div className="lower-grid">
                                <div className="panel">
                                    <div className="panel-head">
                                        <div>
                                            <h3>
                                                Запаси, що потребують уваги{" "}
                                                <span className="pill">{low.length}</span>
                                            </h3>
                                            <p>Товари нижче встановленого мінімуму</p>
                                        </div>

                                        <button
                                            className="link"
                                            onClick={() => setPage("Номенклатура")}
                                        >
                                            Вся номенклатура ↗
                                        </button>
                                    </div>

                                    <ProductTable
                                        rows={low.length ? low : products.slice(0, 3)}
                                        compact
                                    />
                                </div>

                                <div className="panel">
                                    <div className="panel-head">
                                        <div>
                                            <h3>Останні операції</h3>
                                            <p>Активність на складі</p>
                                        </div>
                                        <MoreHorizontal />
                                    </div>

                                    {docs.slice(0, 3).map((document) => (
                                        <div className="activity" key={document.id}>
                                            <span className="activity-icon">
                                                {document.type === "receipt" ? (
                                                    <ArrowDownRight />
                                                ) : document.type === "writeoff" ? (
                                                    <ArrowUpRight />
                                                ) : (
                                                    <ClipboardList />
                                                )}
                                            </span>

                                            <span>
                                                <b>
                                                    {DOCUMENT_TYPES[document.type]?.title ||
                                                        "Складський документ"}
                                                </b>
                                                <small>
                                                    {document.created_at
                                                        ? new Date(document.created_at).toLocaleString(
                                                            "uk-UA",
                                                        )
                                                        : "Дата не вказана"}
                                                </small>
                                            </span>

                                            <em>
                                                {document.status === "draft"
                                                    ? "Чернетка"
                                                    : "Проведено"}
                                            </em>
                                        </div>
                                    ))}

                                    {!docs.length && (
                                        <Empty
                                            title="Операцій поки немає"
                                            text="Створіть перший документ."
                                            action={() => setModal("doc")}
                                        />
                                    )}

                                    <button
                                        className="activity-all"
                                        onClick={() => setPage("Документи")}
                                    >
                                        Переглянути всі документи ↗
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : page === "Номенклатура" ? (
                        <div className="panel full">
                            <div className="panel-head">
                                <div>
                                    <h3>
                                        Каталог товарів{" "}
                                        <span className="pill">{products.length}</span>
                                    </h3>
                                    <p>Товари, штрих-коди й мінімальні залишки</p>
                                </div>

                                <button className="primary" onClick={newProduct}>
                                    <Plus size={16} />
                                    Додати товар
                                </button>
                            </div>

                            <div className="toolbar">
                                <div className="search">
                                    <Search size={16} />
                                    <input
                                        placeholder="Пошук за назвою, SKU або штрих-кодом…"
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                    />
                                </div>

                                <button
                                    className="secondary"
                                    onClick={() => {
                                        setQuery("");
                                        say("Пошук очищено");
                                    }}
                                >
                                    <Filter size={15} />
                                    Очистити
                                </button>

                                <button
                                    className="secondary"
                                    onClick={() => {
                                        const header = [
                                            "SKU",
                                            "Назва",
                                            "Штрих-код",
                                            "Категорія",
                                            "Залишок",
                                            "Мінімум",
                                            "Ціна",
                                        ];

                                        const escapeCsv = (value) =>
                                            `"${String(value ?? "").replace(/"/g, '""')}"`;

                                        const rows = filtered.map((product) => [
                                            product.sku,
                                            product.name,
                                            product.barcode,
                                            product.category,
                                            product.stock,
                                            product.min_stock,
                                            product.price,
                                        ]);

                                        const csv = [
                                            header,
                                            ...rows,
                                        ]
                                            .map((row) => row.map(escapeCsv).join(";"))
                                            .join("\r\n");

                                        const blob = new Blob(
                                            ["\uFEFF", csv],
                                            { type: "text/csv;charset=utf-8;" },
                                        );

                                        const url = URL.createObjectURL(blob);
                                        const link = document.createElement("a");

                                        link.href = url;
                                        link.download = "stockflow-products.csv";
                                        link.click();

                                        URL.revokeObjectURL(url);
                                        say("Каталог експортовано");
                                    }}
                                >
                                    <Download size={15} />
                                    Експорт
                                </button>
                            </div>

                            <ProductTable rows={filtered} />
                        </div>
                    ) : page === "Документи" ? (
                        <div className="panel full">
                            <div className="panel-head">
                                <div>
                                    <h3>
                                        Складські документи{" "}
                                        <span className="pill">{docs.length}</span>
                                    </h3>
                                    <p>Прихід, списання, інвентаризація та переміщення</p>
                                </div>

                                <button
                                    className="primary"
                                    onClick={() => setModal("doc")}
                                >
                                    <Plus size={16} />
                                    Новий документ
                                </button>
                            </div>

                            <div className="table-scroll">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>ТИП ДОКУМЕНТА</th>
                                            <th>НОМЕР</th>
                                            <th>ДАТА</th>
                                            <th>ПОЗИЦІЇ</th>
                                            <th>СТАТУС</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {docs.map((document, index) => (
                                            <tr key={document.id}>
                                                <td>
                                                    <b>
                                                        {DOCUMENT_TYPES[document.type]?.title ||
                                                            "Документ"}
                                                    </b>
                                                </td>
                                                <td>
                                                    SF-{String(index + 1).padStart(5, "0")}
                                                </td>
                                                <td>
                                                    {document.created_at
                                                        ? new Date(document.created_at).toLocaleString(
                                                            "uk-UA",
                                                        )
                                                        : "—"}
                                                </td>
                                                <td>{document.lines?.length || 0}</td>
                                                <td>
                                                    <Status low={document.status === "draft"}>
                                                        {document.status === "draft"
                                                            ? "Чернетка"
                                                            : "Проведено"}
                                                    </Status>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {!docs.length && (
                                    <Empty
                                        title="Документів ще немає"
                                        text="Створіть перший документ."
                                        action={() => setModal("doc")}
                                    />
                                )}
                            </div>
                        </div>
                    ) : page === "Склади" ? (
                        <div className="panel full">
                            <div className="panel-head">
                                <div>
                                    <h3>Склади</h3>
                                    <p>Розташування та залишки в системі</p>
                                </div>

                                <button
                                    className="primary"
                                    onClick={() => say("Створіть склад у Django Admin")}
                                >
                                    <Plus size={16} />
                                    Додати склад
                                </button>
                            </div>

                            <div className="warehouse-card">
                                <Warehouse size={28} />
                                <div>
                                    <b>Центральний склад</b>
                                    <small>Київ · KYIV-01</small>
                                </div>
                                <b>{products.length} SKU</b>
                                <Status>Активний</Status>
                            </div>
                        </div>
                    ) : page === "Команда" ? (
                        <div className="panel full">
                            <div className="panel-head">
                                <div>
                                    <h3>Команда складу</h3>
                                    <p>Користувачі та рівні доступу</p>
                                </div>

                                <button
                                    className="primary"
                                    onClick={newUser}
                                    disabled={offline}
                                >
                                    <Plus size={16} />
                                    Додати користувача
                                </button>
                            </div>

                            {teamLoading && team.length === 0 && (
                                <p>Завантажуємо команду…</p>
                            )}

                            {team.map((member) => {
                                const membership = member.memberships[0];
                                const isSelf = member.id === user?.id;

                                return (
                                    <div className="warehouse-card" key={member.id}>
                                        <span className="avatar">
                                            {(member.name || member.email || "К")
                                                .slice(0, 1)
                                                .toUpperCase()}
                                        </span>

                                        <div>
                                            <b>
                                                {member.name}
                                                {isSelf && " (ви)"}
                                            </b>
                                            <small>
                                                {member.email}
                                                {membership
                                                    ? ` · ${membership.warehouse_name}`
                                                    : " · без складу"}
                                            </small>
                                        </div>

                                        <select
                                            className="role-select"
                                            value={membership?.role ?? ""}
                                            disabled={isSelf || !membership}
                                            onChange={(event) =>
                                                updateMember(
                                                    member,
                                                    { role: event.target.value },
                                                    "Роль оновлено",
                                                )
                                            }
                                            aria-label={`Роль ${member.email}`}
                                        >
                                            {!membership && <option value="">—</option>}
                                            {Object.entries(ROLES).map(([value, label]) => (
                                                <option key={value} value={value}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>

                                        <Status low={!member.is_active}>
                                            {member.is_active ? "Активний" : "Заблокований"}
                                        </Status>

                                        {!isSelf && (
                                            <button
                                                className="secondary"
                                                onClick={() =>
                                                    updateMember(
                                                        member,
                                                        { is_active: !member.is_active },
                                                        member.is_active
                                                            ? "Акаунт заблоковано"
                                                            : "Акаунт розблоковано",
                                                    )
                                                }
                                            >
                                                {member.is_active ? "Заблокувати" : "Розблокувати"}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="panel full">
                            <div className="panel-head">
                                <div>
                                    <h3>{page}</h3>
                                    <p>Параметри StockFlow</p>
                                </div>
                            </div>

                            <p>Цей розділ поки перебуває в розробці.</p>
                        </div>
                    )}
                </div>

                <footer>
                    <span>© 2026 StockFlow Systems</span>
                    <span>
                        ● {offline ? "Офлайн-режим" : "Стан мережі: онлайн"}
                    </span>
                    <span>Довідка · Політика конфіденційності</span>
                </footer>
            </main>

            {modal && (
                <div
                    className="backdrop"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) setModal("");
                    }}
                >
                    <div
                        className="modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="modal-title"
                    >
                        <div className="modal-head">
                            <div>
                                <div className="eyebrow muted">НОВА ОПЕРАЦІЯ</div>
                                <h2 id="modal-title">
                                    {modal === "product"
                                        ? "Новий товар"
                                        : modal === "user"
                                          ? "Новий користувач"
                                          : "Створити документ"}
                                </h2>
                            </div>

                            <button
                                className="bell"
                                onClick={() => setModal("")}
                                aria-label="Закрити"
                            >
                                <X />
                            </button>
                        </div>

                        {modal === "product" ? (
                            <form
                                onSubmit={saveProduct}
                                className="modal-form"
                            >
                                <label>
                                    Назва товару
                                    <input
                                        required
                                        value={form.name || ""}
                                        onChange={(event) =>
                                            updateForm("name", event.target.value)
                                        }
                                    />
                                </label>

                                <div className="form-row">
                                    <label>
                                        SKU
                                        <input
                                            required
                                            value={form.sku || ""}
                                            onChange={(event) =>
                                                updateForm("sku", event.target.value)
                                            }
                                        />
                                    </label>

                                    <label>
                                        Штрих-код
                                        <input
                                            value={form.barcode || ""}
                                            onChange={(event) =>
                                                updateForm("barcode", event.target.value)
                                            }
                                        />
                                    </label>
                                </div>

                                <div className="form-row">
                                    <label>
                                        Категорія
                                        <input
                                            value={form.category || ""}
                                            onChange={(event) =>
                                                updateForm("category", event.target.value)
                                            }
                                        />
                                    </label>

                                    <label>
                                        Одиниця
                                        <select
                                            value={form.unit || "шт"}
                                            onChange={(event) =>
                                                updateForm("unit", event.target.value)
                                            }
                                        >
                                            <option value="шт">шт</option>
                                            <option value="кг">кг</option>
                                            <option value="упак">упак</option>
                                        </select>
                                    </label>
                                </div>

                                <div className="form-row">
                                    <label>
                                        Залишок
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.001"
                                            required
                                            value={form.stock ?? 0}
                                            onChange={(event) =>
                                                updateForm("stock", event.target.value)
                                            }
                                        />
                                    </label>

                                    <label>
                                        Мінімум
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.001"
                                            required
                                            value={form.min_stock ?? 0}
                                            onChange={(event) =>
                                                updateForm("min_stock", event.target.value)
                                            }
                                        />
                                    </label>
                                </div>

                                <label>
                                    Ціна, ₴
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        required
                                        value={form.price ?? 0}
                                        onChange={(event) =>
                                            updateForm("price", event.target.value)
                                        }
                                    />
                                </label>

                                <div className="modal-actions">
                                    <button
                                        type="button"
                                        className="secondary"
                                        onClick={() => setModal("")}
                                    >
                                        Скасувати
                                    </button>

                                    <button className="primary">
                                        <Plus size={15} />
                                        Зберегти товар
                                    </button>
                                </div>
                            </form>
                        ) : modal === "user" ? (
                            <form
                                onSubmit={saveUser}
                                className="modal-form"
                            >
                                <label>
                                    Ім’я та прізвище
                                    <input
                                        required
                                        value={form.name || ""}
                                        onChange={(event) =>
                                            updateForm("name", event.target.value)
                                        }
                                    />
                                </label>

                                <label>
                                    Робочий email
                                    <input
                                        required
                                        type="email"
                                        placeholder="name@company.com"
                                        value={form.email || ""}
                                        onChange={(event) =>
                                            updateForm("email", event.target.value)
                                        }
                                    />
                                </label>

                                <label>
                                    Тимчасовий пароль
                                    <input
                                        required
                                        type="password"
                                        minLength={8}
                                        autoComplete="new-password"
                                        value={form.password || ""}
                                        onChange={(event) =>
                                            updateForm("password", event.target.value)
                                        }
                                    />
                                </label>

                                <div className="form-row">
                                    <label>
                                        Роль
                                        <select
                                            value={form.role || "worker"}
                                            onChange={(event) =>
                                                updateForm("role", event.target.value)
                                            }
                                        >
                                            {Object.entries(ROLES).map(([value, label]) => (
                                                <option key={value} value={value}>
                                                    {label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label>
                                        Склад
                                        <select
                                            required
                                            value={form.warehouse ?? ""}
                                            onChange={(event) =>
                                                updateForm("warehouse", event.target.value)
                                            }
                                        >
                                            {warehouses.map((warehouse) => (
                                                <option key={warehouse.id} value={warehouse.id}>
                                                    {warehouse.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                <div className="modal-actions">
                                    <button
                                        type="button"
                                        className="secondary"
                                        onClick={() => setModal("")}
                                    >
                                        Скасувати
                                    </button>

                                    <button className="primary">
                                        <Plus size={15} />
                                        Створити акаунт
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="doc-options">
                                {Object.entries(DOCUMENT_TYPES).map(
                                    ([type, document]) => {
                                        const Icon = document.Icon;

                                        return (
                                            <button
                                                key={type}
                                                onClick={() => newDoc(type)}
                                            >
                                                <span>
                                                    <Icon size={18} />
                                                </span>

                                                <b>
                                                    {document.title}
                                                    <small>{document.description}</small>
                                                </b>

                                                <ArrowUpRight size={15} />
                                            </button>
                                        );
                                    },
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {toast && <Toast text={toast} />}
        </div>
    );
}

function ProductTable({ rows, compact = false }) {
    return (
        <div className="table-scroll">
            <table>
                <thead>
                    <tr>
                        <th>ТОВАР</th>
                        <th>SKU</th>

                        {!compact && (
                            <>
                                <th>ШТРИХ-КОД</th>
                                <th>КАТЕГОРІЯ</th>
                            </>
                        )}

                        <th>ЗАЛИШОК</th>

                        {compact && <th>МІНІМУМ</th>}
                        {!compact && <th>ЦІНА</th>}

                        <th>СТАТУС</th>
                    </tr>
                </thead>

                <tbody>
                    {rows.map((product) => {
                        const isLow =
                            Number(product.stock) <= Number(product.min_stock);

                        return (
                            <tr key={product.id}>
                                <td>
                                    <div className="product">
                                        <i>{product.name?.[0] || "?"}</i>
                                        <span>
                                            <b>{product.name}</b>
                                            <small>
                                                {compact ? product.category : product.unit}
                                            </small>
                                        </span>
                                    </div>
                                </td>

                                <td className="mono">{product.sku}</td>

                                {!compact && (
                                    <>
                                        <td className="mono subtle">
                                            {product.barcode || "—"}
                                        </td>
                                        <td>{product.category}</td>
                                    </>
                                )}

                                <td>
                                    <b>{product.stock}</b>{" "}
                                    <small>{product.unit}</small>
                                </td>

                                {compact && (
                                    <td>
                                        {product.min_stock} {product.unit}
                                    </td>
                                )}

                                {!compact && (
                                    <td>
                                        ₴{Number(product.price).toFixed(2)}
                                    </td>
                                )}

                                <td>
                                    <Status low={isLow}>
                                        {isLow ? "Низький запас" : "У нормі"}
                                    </Status>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>

            {!rows.length && (
                <div className="empty">Нічого не знайдено</div>
            )}
        </div>
    );
}

function Metric({ icon: Icon, label, value, delta, hint, color }) {
    return (
        <div className="metric">
            <div>
                <span>{label}</span>
                <i className={color}>
                    <Icon size={17} />
                </i>
            </div>

            <b>{value}</b>

            <small>
                <strong>{delta}</strong> {hint}
            </small>
        </div>
    );
}

function Status({ children, low = false }) {
    return (
        <span className={`status ${low ? "low" : ""}`}>
            <i />
            {children}
        </span>
    );
}

function Brand() {
    return (
        <div className="brand">
            <span className="brand-mark">
                <Package size={20} />
            </span>
            <b>
                stock<span>flow</span>
            </b>
        </div>
    );
}

function Toast({ text }) {
    return (
        <div className="toast" role="status">
            <CheckCircle2 size={17} />
            {text}
        </div>
    );
}

function Empty({ title, text, action }) {
    return (
        <div className="empty">
            <ClipboardList size={30} />
            <b>{title}</b>
            <span>{text}</span>

            <button className="primary" onClick={action}>
                <Plus size={15} />
                Створити документ
            </button>
        </div>
    );
}

function ChartIcon() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M3 3v18h18M6 15l4-4 4 4 6-7" />
        </svg>
    );
}
