/** Document drawer: summary, lines, print / CSV export, and sync-conflict resolution. */
import { ArrowDownToLine, Download, FileText, Printer, TriangleAlert } from "lucide-react";
import useFormField from "../../../app/modals/useFormField";
import useModalAction from "../../../app/modals/useModalAction";
import { useAdmin } from "../../../app/state/AdminProvider";
import { exportCSV } from "../../../shared/lib/csv";
import { statuses, types } from "../../../shared/lib/dictionaries";
import { dateParts, fmt } from "../../../shared/lib/format";
import { Badge, Button, Empty, Table, Tile } from "../../../shared/ui";
import { resolveConflict } from "../api";
import { openConflictOf, statusTone } from "../model";

export default function DocumentDrawer() {
  const { modal, form, data, setData, preview, loading, load, say } = useAdmin();
  const patch = useFormField();
  const run = useModalAction();
  const item = modal.item;
  if (!item) return <Empty>Документ не знайдено.</Empty>;

  const conflict = item.status === "conflict";
  const conflictRecord = conflict ? openConflictOf(data.conflicts, item) : null;
  const localLines = preview ? item.lines || [] : conflictRecord?.local_data?.lines || [];
  const serverLines = preview ? item.lines || [] : conflictRecord?.server_data?.lines || item.lines || [];
  const comparison = conflict
    ? localLines.map((l) => ({
        ...l,
        product_name:
          l.product_name || data.products.find((p) => String(p.id) === String(l.product))?.name || l.sku || "Товар",
        serverQuantity: preview
          ? l.expected_quantity
          : serverLines.find((s) => String(s.product) === String(l.product))?.quantity,
      }))
    : [];

  const resolve = (decision) =>
    run(async () => {
      if (preview)
        setData((d) => ({
          ...d,
          documents: d.documents.map((x) => (x.id === item.id ? { ...x, status: "synced" } : x)),
          notifications: d.notifications.filter((n) => n.target !== "conflict"),
        }));
      else {
        const c = openConflictOf(data.conflicts, item);
        if (!c) throw new Error("Відкритий конфлікт не знайдено. Оновіть дані.");
        await resolveConflict(c.id, decision);
        await load();
      }
      say("Конфлікт вирішено");
    });

  return (
    <>
      <div className="document-heading">
        <Tile>{item.type === "receipt" ? <ArrowDownToLine /> : <FileText />}</Tile>
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
        <Badge tone={statusTone(item.status)}>{statuses[item.status]}</Badge>
        <small>{data.warehouses.find((w) => w.id === item.warehouse)?.name}</small>
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
              <small>Оберіть джерело для вирішення конфлікту документа.</small>
            </span>
          </div>
          <div className="conflict-buttons">
            <Button onClick={() => resolve("kept_local")} disabled={loading}>
              Залишити локальні
            </Button>
            <Button onClick={() => resolve("kept_server")} disabled={loading}>
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
                  <small>{preview ? "22.10 · 09:48" : dateParts(conflictRecord?.created_at).join(" · ")}</small>
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
                    {l.serverQuantity == null ? "—" : fmt(l.serverQuantity)} {l.unit}
                  </strong>
                  <small>
                    {preview ? "22.10 · 10:05" : dateParts(conflictRecord?.server_data?.updated_at).join(" · ")}
                  </small>
                </label>
              </div>
            </div>
          ))}
        </>
      )}
      <Table headers={["Товар", "Кількість", ...(conflict ? ["Облік", "Різниця"] : [])]}>
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
                <td>{fmt(Number(l.quantity) - Number(l.expected_quantity))}</td>
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
              (item.lines || []).map((l) => [l.product_name, l.sku, l.quantity, l.unit]),
            )
          }
        >
          Експорт CSV
        </Button>
        {conflict && (
          <Button
            tone="soft-green"
            onClick={() => resolve(form.source === "server" ? "kept_server" : "kept_local")}
          >
            Застосувати вибір
          </Button>
        )}
      </div>
    </>
  );
}
