import { useEffect, useState } from "react";
import {
  Download,
  Trash2,
  FileText,
  ArrowDownToLine,
  ArrowLeftRight,
  ChevronDown,
} from "lucide-react";
import { types, statuses } from "./data";
import {
  Tabs,
  Button,
  Table,
  Tile,
  Badge,
  Pagination,
  fmt,
  dateParts,
} from "./ui";
import { exportCSV } from "./api";
export default function Documents({ a }) {
  const {
    data,
    preview,
    warehouse,
    query,
    setQuery,
    pagination,
    setPagination,
    open,
  } = a;
  const [type, setType] = useState("all"),
    [status, setStatus] = useState("all"),
    [period, setPeriod] = useState("all"),
    [reverse, setReverse] = useState(false);
  useEffect(
    () => setPagination(1),
    [type, status, period, reverse, setPagination],
  );
  let visible = data.documents.filter(
    (d) =>
      `${d.number} ${d.created_by_name} ${(d.lines || []).map((l) => l.product_name).join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (type === "all" || d.type === type) &&
      (status === "all" || d.status === status) &&
      (!warehouse || String(d.warehouse) === warehouse) &&
      (period === "all" ||
        (preview
          ? period === "week" || d.date === "22.10"
          : d.created_at &&
            new Date(d.created_at).getTime() >
              Date.now() - (period === "today" ? 86400000 : 604800000))),
  );
  if (reverse) visible = [...visible].reverse();
  const rows = visible.slice((pagination - 1) * 10, pagination * 10);
  return (
    <>
      <div className="toolbar">
        <Tabs
          items={[
            ["all", `Усі ${data.documents.length}`],
            ...Object.entries(types).map(([id, label]) => [
              id,
              `${label} ${data.documents.filter((d) => d.type === id).length}`,
            ]),
          ]}
          value={type}
          onChange={setType}
        />
        <Button
          icon={Download}
          onClick={() =>
            exportCSV(
              "warego-documents.csv",
              ["Номер", "Тип", "Склад", "Автор", "Кількість", "Статус"],
              visible.map((d) => [
                d.number,
                types[d.type],
                data.warehouses.find((w) => w.id === d.warehouse)?.name,
                d.created_by_name,
                d.total_quantity,
                statuses[d.status],
              ]),
            )
          }
        >
          Експорт CSV
        </Button>
      </div>
      <div className="filters document-filters">
        <input
          placeholder="Номер, автор або товар"
          aria-label="Пошук документів"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="filter-pills">
          {[
            ["all", "Усі дати"],
            ["today", "Сьогодні"],
            ["week", "7 днів"],
          ].map(([id, label]) => (
            <button
              className={period === id ? "selected" : ""}
              onClick={() => setPeriod(id)}
              key={id}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="filter-pills">
          {[
            ["all", "Усі статуси"],
            ["draft", "Чернетка"],
            ["posted", "Проведено"],
            ["synced", "Синхронізовано"],
            ["conflict", "Конфлікт"],
          ].map(([id, label]) => (
            <button
              className={status === id ? "selected" : ""}
              onClick={() => setStatus(id)}
              key={id}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <section className="panel documents-table">
        <Table
          headers={[
            "Документ",
            <button className="sort" onClick={() => setReverse(!reverse)}>
              Дата <ChevronDown size={20} />
            </button>,
            "Склад",
            "Автор",
            "Поз",
            "Кількість",
            "Статус",
          ]}
          empty={!rows.length}
        >
          {rows.map((d) => {
            const Icon =
              d.type === "writeoff"
                ? Trash2
                : d.type === "transfer"
                  ? ArrowLeftRight
                  : d.type === "receipt"
                    ? ArrowDownToLine
                    : FileText;
            return (
              <tr
                className="clickable"
                key={d.id}
                onClick={() => open("document", d)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") open("document", d);
                }}
              >
                <td>
                  <div className="cell-title">
                    <Tile>
                      <Icon size={24} strokeWidth={1.6} />
                    </Tile>
                    <span>
                      {d.number}
                      <small>{types[d.type]}</small>
                    </span>
                  </div>
                </td>
                <td>
                  {d.date || dateParts(d.created_at)[0]}
                  <small>{d.time || dateParts(d.created_at)[1]}</small>
                </td>
                <td>
                  {preview
                    ? `Склад №${d.warehouse}`
                    : data.warehouses.find((w) => w.id === d.warehouse)?.name ||
                      "—"}
                  {d.type === "transfer" &&
                    (preview
                      ? " → Склад №2"
                      : d.destination_warehouse &&
                        ` → ${data.warehouses.find((w) => w.id === d.destination_warehouse)?.name}`)}
                </td>
                <td>
                  {d.created_by_name}
                  <small>{d.author_code || ""}</small>
                </td>
                <td>{d.positions || d.lines?.length || 0}</td>
                <td>{fmt(d.total_quantity)}</td>
                <td>
                  <Badge
                    tone={
                      d.status === "conflict"
                        ? "red"
                        : d.status === "draft"
                          ? "gray"
                          : d.status === "posted"
                            ? "yellow"
                            : "green"
                    }
                  >
                    {statuses[d.status] || d.status}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </Table>
        <Pagination
          total={visible.length}
          page={pagination}
          onChange={setPagination}
        />
      </section>
      <small className="footnote">
        Чернетки та проведені документи показано за останнім звітом пристрою. На
        сервер вони потрапляють після синхронізації.
      </small>
    </>
  );
}
