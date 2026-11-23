import { Download } from "lucide-react";
import { useAdmin } from "../../../app/state/AdminProvider";
import { exportCSV } from "../../../shared/lib/csv";
import { fmt, initials } from "../../../shared/lib/format";
import { Button, Empty, Table, Tile } from "../../../shared/ui";
import { firstConflict } from "../../documents/model";
import SyncEvents from "../../sync/components/SyncEvents";
import { PREVIEW_CATEGORY_STOCK } from "../../warehouses/model";
import { CategoryChart, ScanChart } from "../components/Charts";
import useDashboardStats from "../hooks/useDashboardStats";
import {
  daySeries,
  hourSeries,
  previewScanSeries,
  previewWorkerRows,
  queueTotal,
  scanTotals,
  workerRows,
} from "../model";

/** Dashboard; with `reports` it is the "Аналітика та звіти" page. */
export default function DashboardPage({ reports = false }) {
  const { data, categories, preview, warehouse, go, open, setLow, admin } = useAdmin();
  const selected = data.warehouses.find((w) => String(w.id) === warehouse),
    total = data.products.reduce((sum, p) => sum + Number(p.stock), 0),
    low = data.products.filter((p) => Number(p.stock) <= Number(p.min_stock));
  const scans = useDashboardStats({ preview, warehouse, version: data.documents }),
    scanSeries = preview
      ? previewScanSeries(!admin)
      : scans.stats && { today: hourSeries(scans.stats.hours), week: daySeries(scans.stats.days) },
    scanTotal = scanTotals(scans.stats);
  const active = preview
      ? previewWorkerRows(data.users, warehouse)
      : workerRows(scans.stats?.workers),
    queue = queueTotal(scans.stats?.workers);
  const metrics = reports
    ? [
        [
          preview ? 3456 : (scanTotal?.week ?? "—"),
          "Сканів за 7 днів",
          preview
            ? "У середньому 494 на день"
            : scanTotal
              ? `У середньому ${fmt(scanTotal.average)} на день`
              : "Немає статистики сканувань",
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
          preview ? (warehouse ? 148 : 174) : (scanTotal?.today ?? "—"),
          "Сканів сьогодні",
          preview
            ? "Зміна 08:00–20:00"
            : scanTotal
              ? "За даними сервера"
              : "Немає статистики сканувань",
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
          preview ? (warehouse ? 26 : 28) : (queue?.pending ?? "—"),
          "Не синхронізовано",
          preview
            ? warehouse
              ? "записів на 1 пристрої"
              : "записів на 2 пристроях"
            : !queue
              ? "Немає звіту про чергу"
              : queue.pending
                ? `документів у черзі · комірників: ${queue.workers}`
                : "Усе синхронізовано",
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
                stock: (PREVIEW_CATEGORY_STOCK[c.id - 1] || [0, 0, 0])[Number(warehouse) - 1],
              }))
            : categories
        }
        warehouse={selected?.name}
        reports={reports}
      />
    ),
    scanChart = (
      <ScanChart
        series={scanSeries}
        reports={reports}
        loading={scans.loading}
        error={scans.error}
      />
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
                <small>{active.filter((u) => u.online).length} онлайн</small>
              </div>
              {active.length ? (
                active.map((u) => (
                  <div className="worker-row" key={u.id}>
                    <Tile>{initials(u.name)}</Tile>
                    <span className="worker-name">
                      {u.name}
                      <small>{u.subtitle}</small>
                    </span>
                    <span className="online">
                      <i className={u.online ? "" : "gray"} />
                      {u.status}
                    </span>
                    <span>
                      {fmt(u.scans)}
                      <small>Сканів</small>
                    </span>
                    <span>
                      {fmt(u.pending)}
                      <small>у черзі</small>
                    </span>
                    <span>
                      {u.time}
                      <small>{u.date}</small>
                    </span>
                  </div>
                ))
              ) : (
                <Empty>
                  {scans.error
                    ? `Не вдалося завантажити комірників: ${scans.error}`
                    : scans.loading
                      ? "Завантаження…"
                      : "Сьогодні ще ніхто не працював."}
                </Empty>
              )}
            </section>
            <section className="panel">
              <div className="list-heading">
                <h2>Синхронізації</h2>
                <button className="text-button" onClick={() => open("sync")}>
                  Усі
                </button>
              </div>
              <SyncEvents />
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
                        open("document", firstConflict(data.documents))
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
