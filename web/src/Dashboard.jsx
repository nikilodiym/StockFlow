import { WifiOff, TriangleAlert, CircleCheck, Download } from "lucide-react";
import { CategoryChart, ScanChart } from "./Charts";
import { Table, Tile, Button, Empty, fmt, initials } from "./ui";
import { exportCSV } from "./api";
export function Events({ a, compact = false }) {
  return (
    <div className={`events ${compact ? "compact" : ""}`}>
      {a.data.events.length ? (
        a.data.events.map((e) => {
          const Icon =
            e.kind === "error"
              ? WifiOff
              : e.kind === "conflict"
                ? TriangleAlert
                : CircleCheck;
          return (
            <button
              className="event-row"
              key={e.id}
              onClick={() =>
                e.kind === "conflict" &&
                a.data.documents.some((d) => d.status === "conflict")
                  ? a.open(
                      "document",
                      a.data.documents.find((d) => d.status === "conflict"),
                    )
                  : !compact && a.open("sync")
              }
            >
              <Tile tone={e.kind === "success" ? "" : "red"}>
                <Icon size={24} strokeWidth={1.6} />
              </Tile>
              <span className="event-copy">
                <span>{e.title}</span>
                <small>{e.body}</small>
              </span>
              <span className="event-time">
                {e.time}
                <small>{e.date}</small>
              </span>
            </button>
          );
        })
      ) : (
        <Empty>Синхронізацій ще немає.</Empty>
      )}
    </div>
  );
}
export default function Dashboard({ a, reports = false }) {
  const { data, categories, preview, warehouse, go, open, setLow } = a;
  const selected = data.warehouses.find((w) => String(w.id) === warehouse),
    total = data.products.reduce((sum, p) => sum + Number(p.stock), 0),
    low = data.products.filter((p) => Number(p.stock) <= Number(p.min_stock));
  const active = preview
    ? data.users
        .filter((u) => [5, 7, 9, 6].includes(u.id))
        .sort((x, y) => [5, 7, 9, 6].indexOf(x.id) - [5, 7, 9, 6].indexOf(y.id))
        .filter((u) => !warehouse || String(u.warehouse) === warehouse)
    : data.users.filter((u) =>
        (data.devices || []).some(
          (d) =>
            d.user === u.id &&
            d.last_seen_at &&
            Date.now() - new Date(d.last_seen_at).getTime() < 900000,
        ),
      );
  const metrics = reports
    ? [
        [
          preview ? 3456 : "—",
          "Сканів за 7 днів",
          preview ? "У середньому 494 на день" : "Немає статистики сканувань",
          "",
        ],
        [
          preview
            ? 12
            : data.documents.filter(
                (d) =>
                  d.created_at &&
                  Date.now() - new Date(d.created_at).getTime() < 604800000,
              ).length,
          "Документів за 7 днів",
          preview ? "Синхронізовано 6" : "За даними сервера",
          "",
        ],
        [
          preview ? 3189 : total,
          "Залишок, од.",
          `${data.products.length} позицій`,
          "",
        ],
        [
          preview
            ? 3
            : data.conflicts.filter((c) => c.status === "open").length,
          "Розбіжності інвентаризації",
          preview ? "Надлишок +10 · нестача -3" : "Невирішені конфлікти",
          "",
        ],
        [low.length, "Нижче мінімуму", "Потрібне поповнення", ""],
      ]
    : [
        [
          preview ? (warehouse ? 1923 : 3189) : total,
          "Залишок, од.",
          `${data.products.length} позицій · ${low.length} нижче мін.`,
          "",
        ],
        [
          preview ? (warehouse ? 148 : 174) : "—",
          "Сканів сьогодні",
          preview ? "Зміна 08:00–20:00" : "Немає статистики сканувань",
          "",
        ],
        [
          preview
            ? warehouse
              ? 6
              : 7
            : data.documents.filter(
                (d) =>
                  d.created_at?.slice(0, 10) ===
                  new Date().toISOString().slice(0, 10),
              ).length,
          "Документів сьогодні",
          preview
            ? "22 жовтня"
            : new Date().toLocaleDateString("uk-UA", {
                day: "numeric",
                month: "long",
              }),
          "",
        ],
        [
          preview ? (warehouse ? 26 : 28) : "—",
          "Не синхронізовано",
          preview
            ? warehouse
              ? "записів на 1 пристрої"
              : "записів на 2 пристроях"
            : "Немає звіту про чергу",
          "amber",
        ],
        [
          data.documents.filter((d) => d.status === "conflict").length ||
            data.conflicts.filter((c) => c.status === "open").length,
          "Конфлікт",
          preview ? "ІНВ-0145" : "Невирішені конфлікти",
          "red",
        ],
      ];
  const categoryChart = (
      <CategoryChart
        categories={
          preview && warehouse
            ? categories.map((c) => ({
                ...c,
                stock: ([
                  [320, 131, 81],
                  [104, 44, 28],
                  [205, 84, 53],
                  [467, 187, 118],
                  [226, 91, 57],
                  [84, 34, 21],
                  [517, 207, 130],
                ][c.id - 1] || [0, 0, 0])[Number(warehouse) - 1],
              }))
            : categories
        }
        warehouse={selected?.name}
        reports={reports}
      />
    ),
    scanChart = (
      <ScanChart preview={preview} reports={reports} manager={!a.admin} />
    );
  return (
    <>
      {reports && (
        <div className="toolbar">
          <small>
            Період: {preview ? "16–22 жовтня" : "останні 7 днів"} ·{" "}
            {selected?.name || "Усі склади"}
          </small>
          <Button
            icon={Download}
            onClick={() =>
              exportCSV(
                "warego-report.csv",
                ["Категорія", "Залишок"],
                categories.map((c) => [c.name, c.stock]),
              )
            }
          >
            Експорт звіту CSV
          </Button>
        </div>
      )}
      <div className="metrics">
        {metrics.map(([value, label, help, tone], i) => (
          <button
            className="metric"
            key={label}
            onClick={() => {
              if (i === 4 && !reports) go("documents");
              else if (i === 4) {
                go("catalog");
                setLow(true);
              } else if (i === 3 && !reports) open("sync");
              else if (label.includes("Документ")) go("documents");
              else if (label.includes("Залишок")) go("catalog");
            }}
          >
            <strong className={tone}>
              {typeof value === "number" ? fmt(value) : value}
            </strong>
            <span>{label}</span>
            <small>{help}</small>
          </button>
        ))}
      </div>
      <div className="dashboard-grid">
        {reports ? (
          <>
            {scanChart}
            {categoryChart}
          </>
        ) : (
          <>
            {categoryChart}
            {scanChart}
          </>
        )}
        {!reports ? (
          <>
            <section className="panel workers-panel">
              <div className="list-heading">
                <h2>Активні комірники</h2>
                <small>
                  {preview
                    ? `${active.filter((u) => u.id !== 6).length} онлайн`
                    : `${active.length} онлайн`}
                </small>
              </div>
              {active.length ? (
                active.map((u, i) => (
                  <div className="worker-row" key={u.id}>
                    <Tile>{initials(u.name)}</Tile>
                    <span className="worker-name">
                      {u.name}
                      <small>
                        Склад №{u.warehouse || u.memberships?.[0]?.warehouse} ·{" "}
                        {u.code || u.id}
                      </small>
                    </span>
                    <span className="online">
                      <i className={u.id === 6 && preview ? "gray" : ""} />
                      {u.id === 6 && preview ? "Зміна з 14:00" : "Онлайн"}
                    </span>
                    <span>
                      {preview
                        ? { 5: 148, 7: 14, 9: 12, 6: 0 }[u.id] || 0
                        : "—"}
                      <small>Сканів</small>
                    </span>
                    <span>
                      {preview ? { 5: 26, 7: 2 }[u.id] || 0 : "—"}
                      <small>у черзі</small>
                    </span>
                    <span>
                      {preview
                        ? { 5: "09:12", 7: "09:12", 9: "10:02", 6: "19:48" }[
                            u.id
                          ]
                        : "—"}
                      <small>{preview ? "22.10" : ""}</small>
                    </span>
                  </div>
                ))
              ) : (
                <Empty>Немає активних комірників.</Empty>
              )}
            </section>
            <section className="panel">
              <div className="list-heading">
                <h2>Активні комірники</h2>
                <button className="text-button" onClick={() => open("sync")}>
                  Усі
                </button>
              </div>
              <Events a={a} />
            </section>
          </>
        ) : (
          <>
            <section className="panel report-bottom">
              <div className="list-heading">
                <h2>Розбіжності під час інвентаризації</h2>
                <small>Факт мінус облік</small>
              </div>
              <Table
                headers={["Товар", "Облік", "Факт", "Різниця"]}
                empty={!preview}
              >
                {preview &&
                  [
                    ["Фарба акрилова біла 2.5л", 118, 126, 8],
                    ["Саморізи 3.5×25 (уп. 1000)", 61, 58, -3],
                    ["Рівень будівельний 60см", 6, 8, 2],
                  ].map(([name, x, y, z]) => (
                    <tr
                      className="clickable"
                      key={name}
                      onClick={() =>
                        open(
                          "document",
                          data.documents.find((d) => d.status === "conflict"),
                        )
                      }
                    >
                      <td>
                        {name}
                        <small>ІНВ-0145 · Склад №1</small>
                      </td>
                      <td>{x}</td>
                      <td>{y}</td>
                      <td>
                        {z > 0 ? "+" : ""}
                        {z}
                      </td>
                    </tr>
                  ))}
              </Table>
            </section>
            <section className="panel report-bottom">
              <div className="list-heading">
                <h2>Низький залишок</h2>
                <button
                  className="text-button"
                  onClick={() => {
                    go("catalog");
                    setLow(true);
                  }}
                >
                  Усі
                </button>
              </div>
              <Table
                headers={["Товар", "SKU", "Залишок", "Мінімум"]}
                empty={!low.length}
              >
                {low.slice(0, 4).map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.sku}</td>
                    <td className="amber">{fmt(p.stock)}</td>
                    <td>{fmt(p.min_stock)}</td>
                  </tr>
                ))}
              </Table>
            </section>
          </>
        )}
      </div>
    </>
  );
}
