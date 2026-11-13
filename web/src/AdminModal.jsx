import { useEffect, useRef } from "react";
import {
  X,
  Plus,
  Trash2,
  Ban,
  LogOut,
  CircleCheck,
  Upload,
  FileText,
  ArrowDownToLine,
  TriangleAlert,
  Printer,
  Download,
} from "lucide-react";
import {
  Button,
  Field,
  Select,
  Tile,
  Table,
  Badge,
  Empty,
  fmt,
  roleOf,
  dateParts,
} from "./ui";
import { roles, types, statuses } from "./data";
import { request, clearSession, exportCSV } from "./api";
import { Events } from "./Dashboard";

export default function AdminModal({ a }) {
  const {
    modal,
    setModal,
    form,
    setForm,
    error,
    setError,
    loading,
    setLoading,
    close,
    data,
    setData,
    preview,
    user,
    mutate,
    load,
    say,
  } = a;
  const dialogRef = useRef(),
    fileRef = useRef(),
    lastFocus = useRef(),
    busy = useRef(false);
  busy.current = loading;
  const patch = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  useEffect(() => {
    if (!modal) return;
    lastFocus.current = document.activeElement;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(
      () =>
        (
          dialogRef.current?.querySelector(
            'input:not(:disabled):not([type="file"]),select:not(:disabled)',
          ) || dialogRef.current?.querySelector("button:not(:disabled)")
        )?.focus(),
      0,
    );
    const key = (e) => {
      if (e.key === "Escape" && !busy.current) close();
      if (e.key === "Tab") {
        const els = [
          ...dialogRef.current.querySelectorAll(
            'button:not(:disabled),input:not(:disabled):not([type="file"]),select:not(:disabled),[tabindex="0"]',
          ),
        ];
        if (!els.length) return;
        if (e.shiftKey && document.activeElement === els[0]) {
          e.preventDefault();
          els.at(-1).focus();
        } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
          e.preventDefault();
          els[0].focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", key);
      document.body.style.overflow = before;
      lastFocus.current?.focus();
    };
  }, [modal?.kind, modal?.item?.id]);
  if (!modal) return null;
  const item = modal.item,
    kind = modal.kind,
    conflict = kind === "document" && item?.status === "conflict";
  const conflictRecord = conflict
    ? data.conflicts.find(
        (c) => String(c.entity_id) === String(item.id) && c.status === "open",
      )
    : null;
  const localLines = preview
    ? item?.lines || []
    : conflictRecord?.local_data?.lines || [];
  const serverLines = preview
    ? item?.lines || []
    : conflictRecord?.server_data?.lines || item?.lines || [];
  const comparison = conflict
    ? localLines.map((l) => ({
        ...l,
        product_name:
          l.product_name ||
          data.products.find((p) => String(p.id) === String(l.product))?.name ||
          l.sku ||
          "Товар",
        serverQuantity: preview
          ? l.expected_quantity
          : serverLines.find((s) => String(s.product) === String(l.product))
              ?.quantity,
      }))
    : [];
  const title = {
    product: item ? "Редагувати товар" : "Новий товар",
    category: item ? "Редагувати категорію" : "Нова категорія",
    unit: item ? "Редагувати одиницю виміру" : "Нова одиниця виміру",
    warehouse: item ? "Редагувати склад" : "Новий склад",
    user: item ? "Редагувати акаунт" : "Новий акаунт",
    password: "Змінити пароль",
    created: "Акаунт створено",
    delete:
      modal.collection === "products" ? "Видалити товар?" : "Видалити запис?",
    block: item?.is_active ? "Заблокувати акаунт?" : "Розблокувати акаунт?",
    logout: "Вийти з акаунта?",
    import: "Імпорт номенклатури",
    sync: "Журнал синхронізацій",
    notification: item?.title,
  };
  async function save(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (kind === "product") {
        const codes = [...(form.barcodesList || [])];
        if (form.barcodeInput) {
          if (!/^\d{8,14}$/.test(form.barcodeInput))
            throw new Error("Штрихкод має містити від 8 до 14 цифр");
          if (!codes.includes(form.barcodeInput)) codes.push(form.barcodeInput);
        }
        const payload = {
          name: form.name.trim(),
          sku: form.sku.trim(),
          min_stock: Number(form.min_stock),
          category_id: form.category_id || null,
          unit: form.unit,
          barcode: codes[0] || "",
        };
        const saved = await mutate(
          "products",
          item,
          preview
            ? {
                ...payload,
                barcodes: codes.map((code, i) => ({
                  id: i,
                  code,
                  is_active: true,
                  is_primary: i === 0,
                })),
                category:
                  data.categories.find(
                    (c) => String(c.id) === String(form.category_id),
                  )?.name || "",
                stock: item?.stock || 0,
              }
            : payload,
          item ? "PATCH" : "POST",
        );
        if (!preview) {
          try {
            for (const code of codes
              .slice(1)
              .filter(
                (code) =>
                  !item?.barcodes?.some((b) => b.code === code && b.is_active),
              ))
              await request("/barcodes/", {
                method: "POST",
                body: JSON.stringify({
                  product: saved.id,
                  code,
                  is_primary: false,
                }),
              });
            for (const b of item?.barcodes || [])
              if (b.is_active && !codes.includes(b.code))
                await request(`/barcodes/${b.id}/`, { method: "DELETE" });
          } catch (err) {
            await load();
            throw new Error(
              "Товар збережено, але не всі штрихкоди оновлено: " + err.message,
            );
          }
          await load();
        }
        say(item ? "Товар оновлено" : "Товар створено");
      } else if (kind === "category") {
        await mutate(
          "categories",
          item,
          preview ? form : { name: form.name.trim() },
          item ? "PATCH" : "POST",
        );
        say("Категорію збережено");
      } else if (kind === "unit") {
        await mutate(
          "units",
          item,
          {
            name: form.name.trim(),
            code: form.code.trim(),
            ...(preview ? { count: item?.count || 0 } : {}),
          },
          item ? "PATCH" : "POST",
        );
        say("Одиницю виміру збережено");
      } else if (kind === "warehouse") {
        await mutate(
          "warehouses",
          item,
          preview
            ? form
            : {
                name: form.name.trim(),
                address: form.address.trim(),
                code:
                  form.code.trim() ||
                  item?.code ||
                  "WH-" + crypto.randomUUID().slice(0, 8),
              },
          item ? "PATCH" : "POST",
        );
        say("Склад збережено");
      } else if (kind === "user") {
        const alphabet =
          "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@";
        const password =
          "Wg!" +
          Array.from(
            crypto.getRandomValues(new Uint8Array(13)),
            (b) => alphabet[b % alphabet.length],
          ).join("");
        const payload = {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role,
          ...(form.warehouse ? { warehouse: form.warehouse } : {}),
          ...(!item ? { password } : {}),
        };
        const demoPayload = {
          ...payload,
          is_active: item?.is_active ?? true,
          is_staff: form.role === "admin",
          memberships: form.warehouse
            ? [
                {
                  warehouse: form.warehouse,
                  role: form.role,
                  warehouse_name: data.warehouses.find(
                    (w) => String(w.id) === String(form.warehouse),
                  )?.name,
                },
              ]
            : [],
        };
        delete demoPayload.password;
        const saved = await mutate(
          "users",
          item,
          preview ? demoPayload : payload,
          item ? "PATCH" : "POST",
        );
        if (!item) {
          setModal({ kind: "created", item: saved });
          setForm({ password });
          return;
        }
        say("Акаунт оновлено");
      } else if (kind === "password") {
        if (!preview)
          await request(`/users/${item.id}/`, {
            method: "PATCH",
            body: JSON.stringify({ password: form.password }),
          });
        if (preview && modal.requestId)
          setData((d) => ({
            ...d,
            requests: d.requests.filter((r) => r.id !== modal.requestId),
          }));
        say("Пароль змінено");
      }
      setModal(null);
    } catch (err) {
      setError(err.message || "Не вдалося зберегти зміни");
    } finally {
      setLoading(false);
    }
  }
  async function confirm() {
    setLoading(true);
    setError("");
    try {
      if (kind === "delete") {
        await mutate(modal.collection, item, {}, "DELETE");
        say("Видалено");
      }
      if (kind === "block") {
        await mutate("users", item, { is_active: !item.is_active }, "PATCH");
        say(item.is_active ? "Акаунт заблоковано" : "Акаунт розблоковано");
      }
      if (kind === "logout") {
        if (!preview && localStorage.getItem("sf_refresh"))
          await request("/auth/logout/", {
            method: "POST",
            body: JSON.stringify({
              refresh: localStorage.getItem("sf_refresh"),
            }),
          });
        clearSession();
        if (preview) {
          location.href = "/";
          return;
        }
        a.setUser(null);
        setData({
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
        });
      }
      setModal(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  async function importFile(file) {
    if (!file) return;
    setLoading(true);
    setError("");
    try {
      if (preview) {
        const text = (await file.text()).replace(/^\uFEFF/, "");
        const lines = text.trim().split(/\r?\n/),
          delimiter = lines[0].includes(";") ? ";" : ",";
        const split = (line) => {
          const cells = [];
          let value = "",
            quoted = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
              if (quoted && line[i + 1] === '"') {
                value += '"';
                i++;
              } else quoted = !quoted;
            } else if (ch === delimiter && !quoted) {
              cells.push(value);
              value = "";
            } else value += ch;
          }
          cells.push(value);
          return cells;
        };
        let added = 0;
        const products = [...data.products],
          start = /штрих|barcode|sku/i.test(lines[0]) ? 1 : 0;
        for (let i = start; i < lines.length; i++) {
          const [barcode, sku, name, cat, unit] = split(lines[i]);
          if (!name || !sku)
            throw new Error(`Рядок ${i + 1}: потрібні назва та SKU`);
          const c = data.categories.find(
            (c) => c.name === cat || c.prefix === cat,
          );
          const value = {
            id: crypto.randomUUID(),
            barcode,
            sku,
            name,
            category: c?.name || cat,
            category_id: c?.id,
            unit: unit || "шт",
            stock: 0,
            min_stock: 5,
          };
          const existing = products.findIndex((p) => p.sku === sku);
          if (existing >= 0)
            products[existing] = {
              ...products[existing],
              ...value,
              id: products[existing].id,
            };
          else products.push(value);
          added++;
        }
        setData((d) => ({ ...d, products }));
        say(`Імпортовано ${added} рядків`);
      } else {
        const body = new FormData();
        body.append("file", file);
        const job = await request("/imports/", { method: "POST", body });
        await load();
        if (job.rows_failed || job.status === "failed")
          throw new Error(
            `Імпорт: ${job.rows_created || 0} створено, ${job.rows_failed || 0} помилок. ${JSON.stringify(job.errors || [])}`,
          );
        say(
          `Імпорт: ${job.rows_created || 0} створено, ${job.rows_updated || 0} оновлено`,
        );
      }
      setModal(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  async function resolve(decision) {
    setLoading(true);
    setError("");
    try {
      if (preview)
        setData((d) => ({
          ...d,
          documents: d.documents.map((x) =>
            x.id === item.id ? { ...x, status: "synced" } : x,
          ),
          notifications: d.notifications.filter((n) => n.target !== "conflict"),
        }));
      else {
        const c = data.conflicts.find(
          (c) => String(c.entity_id) === String(item.id) && c.status === "open",
        );
        if (!c)
          throw new Error("Відкритий конфлікт не знайдено. Оновіть дані.");
        await request(`/sync/conflicts/${c.id}/resolve/`, {
          method: "POST",
          body: JSON.stringify({ decision }),
        });
        await load();
      }
      setModal(null);
      say("Конфлікт вирішено");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  const formKind = [
      "product",
      "category",
      "unit",
      "warehouse",
      "user",
      "password",
    ].includes(kind),
    confirmation = ["delete", "block", "logout", "created"].includes(kind),
    drawer = ["document", "sync"].includes(kind);
  return (
    <div
      className={`modal-overlay ${drawer ? "drawer-overlay" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        ref={dialogRef}
        className={`modal kind-${kind} ${drawer ? "drawer" : ""} ${confirmation ? "confirmation" : ""} ${kind === "import" ? "import-modal" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <button
          className="modal-close"
          onClick={close}
          disabled={loading}
          aria-label="Закрити"
        >
          <X size={19} />
        </button>
        {confirmation && (
          <Tile tone={kind === "created" ? "" : "red"}>
            {kind === "delete" ? (
              <Trash2 />
            ) : kind === "block" ? (
              <Ban />
            ) : kind === "logout" ? (
              <LogOut />
            ) : (
              <CircleCheck />
            )}
          </Tile>
        )}
        {kind !== "document" && <h2 id="dialog-title">{title[kind]}</h2>}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {formKind && (
          <form onSubmit={save} className="modal-form">
            {kind === "product" && (
              <>
                <Field label="Назва">
                  <input
                    placeholder="Наприклад, Фарба акрилова біла 2.5л"
                    required
                    value={form.name || ""}
                    onChange={(e) => patch("name", e.target.value)}
                  />
                </Field>
                <div className="form-grid">
                  <Field label="SKU">
                    <input
                      required
                      placeholder="PNT-0140"
                      value={form.sku || ""}
                      onChange={(e) => patch("sku", e.target.value)}
                    />
                  </Field>
                  <Field label="Мінімум на склад">
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      required
                      value={form.min_stock ?? 5}
                      onChange={(e) => patch("min_stock", e.target.value)}
                    />
                  </Field>
                  <Field label="Категорія">
                    <Select
                      value={form.category_id || ""}
                      onChange={(e) => patch("category_id", e.target.value)}
                    >
                      <option value="">Без категорії</option>
                      {data.categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Одиниця виміру">
                    <Select
                      value={form.unit || ""}
                      onChange={(e) => patch("unit", e.target.value)}
                    >
                      {data.units.map((u) => (
                        <option key={u.id} value={u.code}>
                          {u.code} · {u.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <div className="field">
                  <span>Штрихкоди</span>
                  {form.barcodesList?.length ? (
                    <div className="barcode-list">
                      {form.barcodesList.map((code) => (
                        <span key={code}>
                          {code}
                          <button
                            type="button"
                            aria-label={`Прибрати ${code}`}
                            onClick={() =>
                              patch(
                                "barcodesList",
                                form.barcodesList.filter((c) => c !== code),
                              )
                            }
                          >
                            <X size={15} />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <small>Штрихкодів ще немає</small>
                  )}
                </div>
                <div className="barcode-input">
                  <input
                    placeholder="13 цифр"
                    aria-label="Новий штрихкод"
                    inputMode="numeric"
                    value={form.barcodeInput || ""}
                    onChange={(e) => patch("barcodeInput", e.target.value)}
                  />
                  <Button
                    icon={Plus}
                    onClick={() => {
                      if (!/^\d{8,14}$/.test(form.barcodeInput || "")) {
                        setError("Введіть від 8 до 14 цифр");
                        return;
                      }
                      if (form.barcodesList.includes(form.barcodeInput)) {
                        setError("Штрихкод уже додано");
                        return;
                      }
                      setForm((f) => ({
                        ...f,
                        barcodesList: [...f.barcodesList, f.barcodeInput],
                        barcodeInput: "",
                      }));
                      setError("");
                    }}
                  >
                    Додати
                  </Button>
                </div>
              </>
            )}
            {kind === "category" && (
              <>
                <Field label="Назва">
                  <input
                    required
                    value={form.name || ""}
                    onChange={(e) => patch("name", e.target.value)}
                  />
                </Field>
                <Field label="Префікс SKU">
                  <input
                    value={form.prefix || ""}
                    onChange={(e) =>
                      patch("prefix", e.target.value.toUpperCase())
                    }
                    disabled={!preview || !!item}
                    maxLength={8}
                  />
                </Field>
                {!preview && (
                  <small>
                    Префікс відображається за SKU товарів категорії.
                  </small>
                )}
              </>
            )}
            {kind === "unit" && (
              <>
                <Field label="Позначення">
                  <input
                    required
                    value={form.code || ""}
                    onChange={(e) => patch("code", e.target.value)}
                  />
                </Field>
                <Field label="Назва">
                  <input
                    required
                    value={form.name || ""}
                    onChange={(e) => patch("name", e.target.value)}
                  />
                </Field>
              </>
            )}
            {kind === "warehouse" && (
              <>
                <Field label="Назва">
                  <input
                    required
                    value={form.name || ""}
                    onChange={(e) => patch("name", e.target.value)}
                  />
                </Field>
                <Field label="Адреса">
                  <input
                    value={form.address || ""}
                    onChange={(e) => patch("address", e.target.value)}
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Менеджер">
                    <Select
                      value={form.manager || ""}
                      disabled={!preview}
                      onChange={(e) => patch("manager", e.target.value)}
                    >
                      <option value="">Не призначено</option>
                      {data.users
                        .filter((u) => roleOf(u) === "manager")
                        .map((u) => (
                          <option key={u.id}>{u.name}</option>
                        ))}
                    </Select>
                  </Field>
                  <Field label="Місткість, од.">
                    <input
                      type="number"
                      min="1"
                      value={form.capacity || ""}
                      disabled={!preview}
                      onChange={(e) =>
                        patch("capacity", Number(e.target.value))
                      }
                    />
                  </Field>
                </div>
                {!preview && (
                  <small>
                    Місткість потребує підтримки API. Менеджер призначається
                    через акаунт користувача.
                  </small>
                )}
              </>
            )}
            {kind === "user" && (
              <>
                <Field label="Прізвище та ім’я">
                  <input
                    placeholder="Наприклад, Іван Петренко"
                    required
                    value={form.name || ""}
                    onChange={(e) => patch("name", e.target.value)}
                  />
                </Field>
                <Field label="Email">
                  <input
                    placeholder="name@warego.ua"
                    required
                    type="email"
                    value={form.email || ""}
                    onChange={(e) => patch("email", e.target.value)}
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Роль">
                    <Select
                      value={form.role}
                      disabled={item?.id === user.id}
                      onChange={(e) => patch("role", e.target.value)}
                    >
                      {Object.entries(roles).map(([id, label]) => (
                        <option value={id} key={id}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Склад">
                    <Select
                      value={form.warehouse}
                      required={form.role !== "admin"}
                      onChange={(e) => patch("warehouse", e.target.value)}
                    >
                      <option value="">Усі склади</option>
                      {data.warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                {!item && (
                  <div className="note">
                    Тимчасовий пароль буде створено автоматично. Передайте його
                    користувачу особисто.
                  </div>
                )}
              </>
            )}
            {kind === "password" && (
              <>
                <p>
                  {item.name} · {item.email}
                </p>
                <Field label="Новий пароль">
                  <input
                    required
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    value={form.password || ""}
                    onChange={(e) => patch("password", e.target.value)}
                  />
                </Field>
                <small>
                  Щонайменше 8 символів. Використайте літери та цифри.
                </small>
              </>
            )}
            <div className="modal-footer">
              {kind === "warehouse" && item && (
                <Button
                  tone="outline-danger"
                  onClick={() =>
                    setModal({ kind: "delete", item, collection: "warehouses" })
                  }
                >
                  Видалити
                </Button>
              )}
              <span />
              <Button onClick={close} disabled={loading}>
                Скасувати
              </Button>
              <button className="button primary" disabled={loading}>
                {loading
                  ? "Збереження…"
                  : kind === "user" && !item
                    ? "Створити акаунт"
                    : item
                      ? "Зберегти"
                      : "Створити"}
              </button>
            </div>
          </form>
        )}
        {kind === "import" && (
          <>
            <p>
              Завантажте файл CSV з полями: штрихкод, SKU, назва, категорія,
              одиниця. Роздільник «;» або кома. Нові SKU буде додано, наявні
              оновлено.
            </p>
            <div className="note">
              4820119020001;PNT-0101;Фарба акрилова біла 2.5л;PNT;шт
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              hidden
              ref={fileRef}
              onChange={(e) => importFile(e.target.files[0])}
            />
            <div className="modal-footer">
              <Button onClick={close} disabled={loading}>
                Скасувати
              </Button>
              <Button
                icon={Upload}
                tone="yellow"
                onClick={() => fileRef.current.click()}
                disabled={loading}
              >
                {loading ? "Імпорт…" : "Обрати файл"}
              </Button>
            </div>
          </>
        )}
        {kind === "delete" && (
          <>
            <p>
              {item.name}
              {item.sku ? ` (${item.sku})` : ""} зникне з{" "}
              {modal.collection === "products"
                ? "каталогу на всіх складах і на пристроях після синхронізації."
                : "активного списку."}
            </p>
            <div className="modal-footer">
              <Button onClick={close} disabled={loading}>
                Скасувати
              </Button>
              <Button tone="danger" onClick={confirm} disabled={loading}>
                Видалити
              </Button>
            </div>
          </>
        )}
        {kind === "block" && (
          <>
            <p>
              {item.name}{" "}
              {item.is_active
                ? "не зможе увійти в застосунок і панель. Незавершені чернетки лишаться на пристрої."
                : "знову зможе входити в застосунок і панель."}
            </p>
            <div className="modal-footer">
              <Button onClick={close} disabled={loading}>
                Скасувати
              </Button>
              <Button
                tone={item.is_active ? "danger" : "primary"}
                onClick={confirm}
                disabled={loading}
              >
                {item.is_active ? "Заблокувати" : "Розблокувати"}
              </Button>
            </div>
          </>
        )}
        {kind === "logout" && (
          <>
            <p>Сесію буде завершено. Незбережені зміни у формах зникнуть.</p>
            <div className="modal-footer">
              <Button onClick={close} disabled={loading}>
                Скасувати
              </Button>
              <Button tone="primary" onClick={confirm} disabled={loading}>
                Вийти
              </Button>
            </div>
          </>
        )}
        {kind === "created" && (
          <>
            <p>
              {item.name} · {item.code || String(item.id).slice(0, 8)}
            </p>
            <p>
              Тимчасовий пароль:{" "}
              <strong className="credential">{form.password}</strong>
              <br />
              Передайте його особисто.
            </p>
            <div className="modal-footer">
              <Button tone="primary" onClick={close}>
                Зрозуміло
              </Button>
            </div>
          </>
        )}
        {kind === "sync" && (
          <>
            <div className="note">
              {preview
                ? "Не синхронізовано зараз: Склад №1 · 26, Склад №2 · 2, Склад №3 · 0"
                : "Історія синхронізацій за даними сервера"}
            </div>
            <Events a={a} compact />
          </>
        )}
        {kind === "notification" && (
          <>
            <p>{item.body}</p>
            <div className="modal-footer">
              <Button
                tone="primary"
                onClick={async () => {
                  try {
                    if (!preview)
                      await request(`/notifications/${item.id}/read/`, {
                        method: "POST",
                      });
                    setData((d) => ({
                      ...d,
                      notifications: d.notifications.filter(
                        (n) => n.id !== item.id,
                      ),
                    }));
                    close();
                  } catch (err) {
                    setError(err.message);
                  }
                }}
              >
                Позначити прочитаним
              </Button>
            </div>
          </>
        )}
        {kind === "document" &&
          (item ? (
            <>
              <div className="document-heading">
                <Tile>
                  {item.type === "receipt" ? <ArrowDownToLine /> : <FileText />}
                </Tile>
                <div>
                  <h2 id="dialog-title">{item.number}</h2>
                  <small>
                    {types[item.type]} ·{" "}
                    {item.date || dateParts(item.created_at)[0]}{" "}
                    {item.time || dateParts(item.created_at)[1]}
                  </small>
                </div>
              </div>
              <div className="document-status">
                <Badge
                  tone={
                    conflict
                      ? "red"
                      : item.status === "draft"
                        ? "gray"
                        : item.status === "posted"
                          ? "yellow"
                          : "green"
                  }
                >
                  {statuses[item.status]}
                </Badge>
                <small>
                  {data.warehouses.find((w) => w.id === item.warehouse)?.name}
                </small>
              </div>
              <div className="document-summary">
                <div>
                  <strong>{item.positions || item.lines?.length}</strong>
                  <small>Позицій</small>
                </div>
                <div>
                  <strong>{fmt(item.total_quantity)}</strong>
                  <small>Загальна кількість</small>
                </div>
                <div>
                  <strong>{item.created_by_name?.split(" ").at(-1)}</strong>
                  <small>Автор · {item.author_code || ""}</small>
                </div>
              </div>
              {conflict && (
                <>
                  <div className="conflict-warning">
                    <TriangleAlert size={19} />
                    <span>
                      Дані змінилися на сервері
                      <small>
                        Оберіть джерело для вирішення конфлікту документа.
                      </small>
                    </span>
                  </div>
                  <div className="conflict-buttons">
                    <Button
                      onClick={() => resolve("kept_local")}
                      disabled={loading}
                    >
                      Залишити локальні
                    </Button>
                    <Button
                      onClick={() => resolve("kept_server")}
                      disabled={loading}
                    >
                      Прийняти серверні
                    </Button>
                  </div>
                  {comparison.map((l, i) => (
                    <div className="conflict-item" key={i}>
                      <p>{l.product_name}</p>
                      <div>
                        <label>
                          <input
                            type="radio"
                            name={`conflict-${i}`}
                            checked={form.source !== "server"}
                            onChange={() => patch("source", "local")}
                          />
                          <small>Локально</small>
                          <strong>
                            {fmt(l.quantity)} {l.unit}
                          </strong>
                          <small>
                            {preview
                              ? "22.10 · 09:48"
                              : dateParts(conflictRecord?.created_at).join(
                                  " · ",
                                )}
                          </small>
                        </label>
                        <label>
                          <input
                            type="radio"
                            name={`conflict-${i}`}
                            checked={form.source === "server"}
                            onChange={() => patch("source", "server")}
                          />
                          <small>На сервері</small>
                          <strong>
                            {l.serverQuantity == null
                              ? "—"
                              : fmt(l.serverQuantity)}{" "}
                            {l.unit}
                          </strong>
                          <small>
                            {preview
                              ? "22.10 · 10:05"
                              : dateParts(
                                  conflictRecord?.server_data?.updated_at,
                                ).join(" · ")}
                          </small>
                        </label>
                      </div>
                    </div>
                  ))}
                </>
              )}
              <Table
                headers={[
                  "Товар",
                  "Кількість",
                  ...(conflict ? ["Облік", "Різниця"] : []),
                ]}
              >
                {(item.lines || []).map((l, i) => (
                  <tr key={l.id || i}>
                    <td>
                      {l.product_name}
                      <small>{l.barcode || l.sku || ""}</small>
                    </td>
                    <td>
                      {fmt(l.quantity)} {l.unit || ""}
                    </td>
                    {conflict && (
                      <>
                        <td>{fmt(l.expected_quantity)}</td>
                        <td>
                          {fmt(
                            Number(l.quantity) - Number(l.expected_quantity),
                          )}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </Table>
              <div className="note">
                Автор: {item.created_by_name} · Статус: {statuses[item.status]}
              </div>
              <div className="drawer-footer">
                <Button icon={Printer} onClick={() => window.print()}>
                  Друк
                </Button>
                <Button
                  icon={Download}
                  onClick={() =>
                    exportCSV(
                      item.number + ".csv",
                      ["Товар", "SKU", "Кількість", "Одиниця"],
                      (item.lines || []).map((l) => [
                        l.product_name,
                        l.sku,
                        l.quantity,
                        l.unit,
                      ]),
                    )
                  }
                >
                  Експорт CSV
                </Button>
                {conflict && (
                  <Button
                    tone="soft-green"
                    onClick={() => {
                      resolve(
                        form.source === "server" ? "kept_server" : "kept_local",
                      );
                    }}
                  >
                    Застосувати вибір
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Empty>Документ не знайдено.</Empty>
          ))}
      </section>
    </div>
  );
}
