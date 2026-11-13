import { useState } from "react";
import { Segments, Table, Empty, fmt } from "./ui";
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
export function ScanChart({ preview, reports, manager = false }) {
  const [view, setView] = useState("chart"),
    [period, setPeriod] = useState("today");
  const week = reports || period === "week",
    values = week
      ? [790, 0, 0, 750, 805, 908, 174]
      : [
          manager ? 38 : 44,
          manager ? 64 : 75,
          manager ? 46 : 54,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
        ],
    labels = week
      ? ["16.10", "17.10", "18.10", "19.10", "20.10", "21.10", "22.10"]
      : [
          "08",
          "09",
          "10",
          "11",
          "12",
          "13",
          "14",
          "15",
          "16",
          "17",
          "18",
          "19",
        ];
  return (
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <h2>Динаміка сканування</h2>
          <small>
            {reports
              ? "Останні 7 днів, 22.10 ще триває"
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
      {!preview ? (
        <Empty>Сервер поки не надає погодинну статистику сканувань.</Empty>
      ) : view === "chart" ? (
        <div className="scan-chart">
          <div className="y-axis">
            <span>{week ? "1 000" : "80"}</span>
            <span>{week ? "500" : "40"}</span>
            <span>0</span>
          </div>
          <div className="plot">
            {values.map((n, i) => (
              <div className="scan-column" key={i}>
                <div className="column-space">
                  {n > 0 ? (
                    <div
                      className={`column ${i === (week ? 6 : 2) ? "green" : ""}`}
                      style={{ height: `${(n / (week ? 1000 : 85)) * 100}%` }}
                    >
                      <b>{n}</b>
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
            <tr key={i}>
              <td>{labels[i]}</td>
              <td>{n || "—"}</td>
            </tr>
          ))}
        </Table>
      )}
    </section>
  );
}
