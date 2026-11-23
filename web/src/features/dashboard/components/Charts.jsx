import { useState } from "react";
import { fmt } from "../../../shared/lib/format";
import { Empty, Segments, Table } from "../../../shared/ui";
export function CategoryChart({ categories, warehouse, reports }) {
  const [view, setView] = useState("chart");
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <h2>{reports ? "Статистика залишків" : "Залишки за категоріями"}</h2>
          <small>{warehouse || "Усі склади"}</small>
        </div>
        <Segments
          items={[
            ["chart", "Графік"],
            ["table", "Таблиця"],
          ]}
          value={view}
          onChange={setView}
        />
      </div>
      {view === "chart" ? (
        <div className="category-chart">
          {categories.map((c) => (
            <div className="category-bar" key={c.id}>
              <span>{c.name}</span>
              <div className="bar-track">
                <i
                  style={{
                    width: `${(Number(c.stock) / Math.max(1, ...categories.map((x) => Number(x.stock)))) * 100}%`,
                  }}
                />
              </div>
              <span>{fmt(c.stock)}</span>
            </div>
          ))}
        </div>
      ) : (
        <Table headers={["Категорія", "Залишок"]} empty={!categories.length}>
          {categories.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{fmt(c.stock)}</td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}
/**
 * Scans per hour today / per day for 7 days. `series` = { today, week } from model.js
 * (demo series in preview mode); `loading` / `error` replace the chart while there is no data.
 */
export function ScanChart({ series, reports, loading = false, error = "" }) {
  const [view, setView] = useState("chart"),
    [period, setPeriod] = useState("today");
  const week = reports || period === "week",
    current = series?.[week ? "week" : "today"],
    values = current?.values || [],
    labels = current?.labels || [];
  const status = error
    ? `Не вдалося завантажити статистику сканувань: ${error}`
    : loading && !current
      ? "Завантаження статистики…"
      : !values.some((n) => n > 0)
        ? week
          ? "За останні 7 днів сканувань немає."
          : "Сьогодні ще немає сканувань."
        : "";
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <h2>Динаміка сканування</h2>
          <small>
            {reports
              ? `Останні 7 днів, ${labels.at(-1) || "сьогодні"} ще триває`
              : week
                ? "За останні 7 днів"
                : "Сьогодні за годинами"}
          </small>
        </div>
        <div className="chart-controls">
          {!reports && (
            <Segments
              items={[
                ["today", "Сьогодні"],
                ["week", "7 днів"],
              ]}
              value={period}
              onChange={setPeriod}
            />
          )}
          <Segments
            items={[
              ["chart", "Графік"],
              ["table", "Таблиця"],
            ]}
            value={view}
            onChange={setView}
          />
        </div>
      </div>
      {status ? (
        <Empty>{status}</Empty>
      ) : view === "chart" ? (
        <div className="scan-chart">
          <div className="y-axis">
            <span>{current.ticks[0]}</span>
            <span>{current.ticks[1]}</span>
            <span>0</span>
          </div>
          <div className="plot">
            {values.map((n, i) => (
              <div className="scan-column" key={labels[i]}>
                <div className="column-space">
                  {n > 0 ? (
                    <div
                      className={`column ${i === current.highlight ? "green" : ""}`}
                      style={{ height: `${(n / current.scale) * 100}%` }}
                      title={`${labels[i]}: ${fmt(n)}`}
                    >
                      <b>{fmt(n)}</b>
                    </div>
                  ) : (
                    <div className="zero">—</div>
                  )}
                </div>
                <small>{labels[i]}</small>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Table headers={["Період", "Сканувань"]}>
          {values.map((n, i) => (
            <tr key={labels[i]}>
              <td>{labels[i]}</td>
              <td>{n ? fmt(n) : "—"}</td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}
