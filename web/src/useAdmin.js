import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { initialData } from "./data";
import { request, getAll, clearSession } from "./api";
import { roleOf, dateParts } from "./ui";
const emptyData = {
  products: [],
  categories: [],
  units: [],
  warehouses: [],
  users: [],
  documents: [],
  events: [],
  notifications: [],
  requests: [],
  conflicts: [],
  devices: [],
  stocks: [],
};
export default function useAdmin() {
  const params = new URLSearchParams(location.search),
    preview = params.get("preview") === "1";
  const [user, setUser] = useState(() => {
    if (preview)
      return initialData().users[params.get("role") === "manager" ? 1 : 0];
    try {
      return JSON.parse(localStorage.getItem("sf_user") || "null");
    } catch {
      return null;
    }
  });
  const [data, setData] = useState(() => {
    if (!preview) return emptyData;
    try {
      return (
        JSON.parse(sessionStorage.getItem("warego-preview") || "null") ||
        (() => {
          const seed = initialData();
          if (params.get("role") === "manager")
            seed.notifications = seed.notifications.filter(
              (n) => n.target !== "requests",
            );
          return seed;
        })()
      );
    } catch {
      return initialData();
    }
  });
  const [page, setPage] = useState(() =>
    [
      "dashboard",
      "catalog",
      "documents",
      "users",
      "warehouses",
      "reports",
    ].includes(location.hash.slice(1))
      ? location.hash.slice(1)
      : "dashboard",
  );
  const [warehouse, setWarehouse] = useState(
      preview && params.get("role") === "manager" ? "1" : "",
    ),
    [query, setQuery] = useState(""),
    [pagination, setPagination] = useState(1),
    [modal, setModal] = useState(null),
    [form, setForm] = useState({}),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState(""),
    [toast, setToast] = useState(""),
    [low, setLow] = useState(false),
    [userTab, setUserTab] = useState("accounts");
  const admin = roleOf(user) === "admin";
  const loadSequence = useRef(0);
  const say = useCallback(setToast, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (preview) sessionStorage.setItem("warego-preview", JSON.stringify(data));
  }, [data, preview]);
  const go = useCallback((next) => {
    setPage(next);
    location.hash = next;
    setQuery("");
    setPagination(1);
  }, []);
  useEffect(() => {
    const fn = () => {
      const next = location.hash.slice(1);
      if (
        [
          "dashboard",
          "catalog",
          "documents",
          "users",
          "warehouses",
          "reports",
        ].includes(next)
      ) {
        setPage(next);
        setQuery("");
        setPagination(1);
      }
    };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  useEffect(() => setPagination(1), [query, warehouse, low]);
  useEffect(() => {
    if (user && !admin && page === "users") go("dashboard");
  }, [page, user, admin, go]);
  useEffect(() => {
    if (user && !user.is_staff && user.memberships?.length === 1)
      setWarehouse(String(user.memberships[0].warehouse));
  }, [user]);
  function open(kind, item = null, values = {}, extra = {}) {
    setModal({ kind, item, ...extra });
    setForm(values);
    setError("");
  }
  function close() {
    if (!loading) {
      setModal(null);
      setError("");
    }
  }
  const load = useCallback(async () => {
    if (preview || !user) return;
    const sequence = ++loadSequence.current;
    setLoading(true);
    setLoadError("");
    const resources = [
      [
        "products",
        "/products/?ordering=sku" +
          (warehouse ? "&warehouse=" + warehouse : ""),
      ],
      ["categories", "/categories/"],
      ["units", "/units/"],
      ["warehouses", "/warehouses/"],
      ["documents", "/documents/"],
      ["notifications", "/notifications/"],
      ["conflicts", "/sync/conflicts/"],
      ["batches", "/sync/batches/"],
      ["stocks", "/stocks/"],
      ...(admin
        ? [
            ["users", "/users/"],
            ["devices", "/devices/"],
          ]
        : []),
    ];
    const results = await Promise.allSettled(
      resources.map(async ([key, url]) => [key, await getAll(url)]),
    );
    if (sequence !== loadSequence.current) return;
    const failures = results.flatMap((r, i) =>
      r.status === "rejected"
        ? [`${resources[i][0]}: ${r.reason.message}`]
        : [],
    );
    setData((current) => {
      const next = { ...current };
      results.forEach((r) => {
        if (r.status === "fulfilled") next[r.value[0]] = r.value[1];
      });
      next.documents = next.documents.map((doc) => ({
        ...doc,
        status: next.conflicts.some(
          (c) => String(c.entity_id) === String(doc.id) && c.status === "open",
        )
          ? "conflict"
          : doc.status,
      }));
      next.events = (next.batches || []).map((b) => ({
        id: b.id,
        title: b.items_conflict
          ? "Конфлікт синхронізації"
          : b.items_failed
            ? "Помилка синхронізації"
            : "Синхронізовано",
        body: `${b.user_name || "Користувач"} · ${b.device_name || ""} · ${b.items_ok} записів`,
        kind: b.items_conflict
          ? "conflict"
          : b.items_failed
            ? "error"
            : "success",
        time: dateParts(b.received_at)[1],
        date: dateParts(b.received_at)[0],
      }));
      return next;
    });
    if (
      results.some((r) => r.status === "rejected" && r.reason.status === 401)
    ) {
      clearSession();
      setUser(null);
    } else if (failures.length)
      setLoadError("Частину даних не завантажено. " + failures.join("; "));
    setLoading(false);
  }, [preview, user, admin, warehouse]);
  useEffect(() => {
    load();
    return () => {
      loadSequence.current++;
    };
  }, [load]);
  const mutate = async (collection, item, payload, method = "POST") => {
    if (preview) {
      const saved = {
        ...item,
        ...payload,
        id: item?.id || crypto.randomUUID(),
      };
      setData((d) => ({
        ...d,
        [collection]:
          method === "DELETE"
            ? d[collection].filter((x) => x.id !== item.id)
            : item
              ? d[collection].map((x) => (x.id === item.id ? saved : x))
              : [...d[collection], saved],
      }));
      return saved;
    }
    const result = await request(
      `/${collection}/${item ? item.id + "/" : ""}`,
      {
        method,
        body: method === "DELETE" ? undefined : JSON.stringify(payload),
      },
    );
    setData((d) => ({
      ...d,
      [collection]:
        method === "DELETE"
          ? d[collection].filter((x) => x.id !== item.id)
          : item
            ? d[collection].map((x) => (x.id === item.id ? result : x))
            : [...d[collection], result],
    }));
    return result;
  };
  const categories = useMemo(
    () =>
      data.categories.map((c) => ({
        ...c,
        prefix:
          c.prefix ||
          data.products
            .find((p) => p.category_id === c.id)
            ?.sku?.split("-")[0] ||
          "—",
        count: preview
          ? c.count
          : data.products.filter(
              (p) => p.category_id === c.id || p.category === c.name,
            ).length,
        stock: preview
          ? c.stock
          : data.products
              .filter((p) => p.category_id === c.id || p.category === c.name)
              .reduce((a, p) => a + Number(p.stock), 0),
      })),
    [data.categories, data.products, preview],
  );
  function editProduct(p) {
    open(
      "product",
      p,
      p
        ? {
            ...p,
            unit:
              data.units.find(
                (u) =>
                  u.id === p.base_unit ||
                  u.code === p.unit ||
                  u.name === p.unit,
              )?.code || p.unit,
            barcodesList:
              p.barcodes?.filter((b) => b.is_active).map((b) => b.code) ||
              [p.barcode].filter(Boolean),
          }
        : {
            name: "",
            sku: "",
            min_stock: 5,
            category_id: data.categories[0]?.id || "",
            unit: data.units[0]?.code || "шт",
            barcodesList: [],
            barcodeInput: "",
          },
    );
  }
  function editUser(u) {
    open(
      "user",
      u,
      u
        ? {
            ...u,
            role: roleOf(u),
            warehouse: u.warehouse || u.memberships?.[0]?.warehouse || "",
          }
        : {
            name: "",
            email: "",
            role: "worker",
            warehouse: data.warehouses[0]?.id || "",
          },
    );
  }
  function editWarehouse(w) {
    open(
      "warehouse",
      w,
      w || { name: "", address: "", code: "", capacity: 6000, manager: "" },
    );
  }
  return {
    preview,
    user,
    setUser,
    data,
    setData,
    page,
    go,
    warehouse,
    setWarehouse,
    query,
    setQuery,
    pagination,
    setPagination,
    modal,
    setModal,
    form,
    setForm,
    error,
    setError,
    loading,
    setLoading,
    loadError,
    toast,
    say,
    low,
    setLow,
    userTab,
    setUserTab,
    admin,
    open,
    close,
    load,
    mutate,
    categories,
    editProduct,
    editUser,
    editWarehouse,
  };
}
