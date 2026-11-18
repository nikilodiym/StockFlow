import { useEffect, useState } from "react";
import {
  Plus,
  Upload,
  Download,
  PencilLine,
  Trash2,
  ChevronDown,
  CircleCheck,
} from "lucide-react";
import {
  Tabs,
  Button,
  Select,
  Table,
  Tile,
  IconButton,
  Pagination,
  fmt,
} from "./ui";
import { exportCSV } from "./api";
export default function Catalog({ a }) {
  const {
    data,
    admin,
    preview,
    categories,
    query,
    setQuery,
    low,
    setLow,
    pagination,
    setPagination,
    open,
    editProduct,
    warehouse,
  } = a;
  const [tab, setTab] = useState("products"),
    [category, setCategory] = useState(""),
    [sort, setSort] = useState(false);
  useEffect(() => setPagination(1), [tab, category, sort, setPagination]);
  let filtered = data.products.filter(
    (p) =>
      `${p.name} ${p.sku} ${p.barcode}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!category ||
        String(p.category_id) === category ||
        p.category === category) &&
      (!low || Number(p.stock) <= Number(p.min_stock)),
  );
  if (sort) filtered = [...filtered].sort((x, y) => y.sku.localeCompare(x.sku));
  const rows = filtered.slice((pagination - 1) * 10, pagination * 10),
    editCategory = (c) => open("category", c, c || { name: "", prefix: "" }),
    editUnit = (u) => open("unit", u, u || { name: "", code: "" });
  return (
    <>
      <div className="toolbar">
        <Tabs
          items={[
            ["products", `Товари ${data.products.length}`],
            ["categories", `Категорії ${categories.length}`],
            ["units", `Одиниці виміру ${data.units.length}`],
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="actions">
          {tab === "products" ? (
            <>
              {admin && (
                <Button icon={Upload} onClick={() => open("import")}>
                  Імпорт CSV
                </Button>
              )}
              <Button
                icon={Download}
                onClick={() =>
                  exportCSV(
                    "warego-products.csv",
                    [
                      "Штрихкод",
                      "SKU",
                      "Назва",
                      "Категорія",
                      "Одиниця",
                      "Залишок",
                    ],
                    filtered.map((p) => [
                      p.barcode,
                      p.sku,
                      p.name,
                      p.category,
                      p.unit,
                      p.stock,
                    ]),
                  )
                }
              >
                Експорт CSV
              </Button>
              {admin && (
                <Button tone="yellow" icon={Plus} onClick={() => editProduct()}>
                  Додати товар
                </Button>
              )}
            </>
          ) : (
            admin && (
              <Button
                tone="yellow"
                icon={Plus}
                onClick={() =>
                  tab === "categories" ? editCategory() : editUnit()
                }
              >
                Додати {tab === "categories" ? "категорію" : "одиницю"}
              </Button>
            )
          )}
        </div>
      </div>
      {tab === "products" && (
        <>
          <div className="filters">
            <input
              aria-label="Пошук товарів"
              placeholder="Назва, SKU або штрихкод"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Select
              value={category}
              label="Категорія"
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Усі категорії</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Button
              tone={low ? "soft-green" : ""}
              onClick={() => setLow(!low)}
              aria-pressed={low}
            >
              Нижче мінімуму
            </Button>
            <small className="filter-caption">
              Залишок:{" "}
              {data.warehouses.find((w) => String(w.id) === warehouse)?.name ||
                "Усі склади"}
            </small>
          </div>
          <section className="panel catalog-products">
            <Table
              headers={[
                "Товар",
                <button className="sort" onClick={() => setSort(!sort)}>
                  SKU <ChevronDown size={20} />
                </button>,
                "Штрихкод",
                "Категорія",
                "Од",
                "Залишок",
                "Дії",
              ]}
              empty={!rows.length}
            >
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="cell-title">
                      <Tile>{p.sku.split("-")[0]}</Tile>
                      <span>{p.name}</span>
                    </div>
                  </td>
                  <td>{p.sku}</td>
                  <td>{p.barcode || "—"}</td>
                  <td>{p.category || "—"}</td>
                  <td>{p.unit}</td>
                  <td className="stock-cell">
                    {fmt(p.stock)}
                    {Number(p.stock) <= Number(p.min_stock) && (
                      <small className="red">нижче мінімуму</small>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      {admin ? (
                        <>
                          <IconButton
                            icon={PencilLine}
                            label={`Редагувати ${p.name}`}
                            onClick={() => editProduct(p)}
                          />
                          <IconButton
                            danger
                            icon={Trash2}
                            label={`Видалити ${p.name}`}
                            onClick={() =>
                              open("delete", p, {}, { collection: "products" })
                            }
                          />
                        </>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
            <Pagination
              total={filtered.length}
              page={pagination}
              onChange={setPagination}
            />
          </section>
        </>
      )}
      {tab === "categories" && (
        <section className="panel">
          <Table
            headers={[
              "Категорія",
              "Префікс SKU",
              "Товарів",
              "Залишок, од.",
              "Дії",
            ]}
            empty={!categories.length}
          >
            {categories.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="cell-title">
                    <Tile>
                      <CircleCheck size={24} />
                    </Tile>
                    {c.name}
                  </div>
                </td>
                <td>{c.prefix}</td>
                <td>{c.count}</td>
                <td>{fmt(c.stock)}</td>
                <td>
                  <div className="row-actions">
                    {admin && (
                      <>
                        <IconButton
                          icon={PencilLine}
                          label={`Редагувати ${c.name}`}
                          onClick={() => editCategory(c)}
                        />
                        <IconButton
                          danger
                          icon={Trash2}
                          label={`Видалити ${c.name}`}
                          onClick={() =>
                            open("delete", c, {}, { collection: "categories" })
                          }
                        />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
          <div className="table-bottom-space" />
        </section>
      )}
      {tab === "units" && (
        <>
          <section className="panel">
            <Table
              headers={["Позначення", "Назва", "Товарів", "Дії"]}
              empty={!data.units.length}
            >
              {data.units.map((u) => (
                <tr key={u.id}>
                  <td>{u.code}</td>
                  <td>{u.name}</td>
                  <td>
                    {preview
                      ? u.count
                      : data.products.filter((p) => p.base_unit === u.id)
                          .length}
                  </td>
                  <td>
                    <div className="row-actions">
                      {admin && (
                        <>
                          <IconButton
                            icon={PencilLine}
                            label={`Редагувати ${u.name}`}
                            onClick={() => editUnit(u)}
                          />
                          <IconButton
                            danger
                            icon={Trash2}
                            label={`Видалити ${u.name}`}
                            onClick={() =>
                              open("delete", u, {}, { collection: "units" })
                            }
                          />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
            <div className="table-bottom-space" />
          </section>
          <small className="footnote">
            Одиниці виміру прив’язуються у мобільному застосунку на екрані
            ручного введення.
          </small>
        </>
      )}
    </>
  );
}
