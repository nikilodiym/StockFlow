import { Plus, PencilLine, Home } from "lucide-react";
import { Button, Table, Tile, IconButton, fmt, roleOf } from "./ui";
export default function Warehouses({ a }) {
  const { data, preview, admin, categories, editWarehouse, setWarehouse, go } =
    a;
  return (
    <>
      <div className="toolbar">
        <small>
          {data.warehouses.length} склади · місткість і заповненість у одиницях
          товару
        </small>
        {admin && (
          <Button tone="yellow" icon={Plus} onClick={() => editWarehouse()}>
            Додати склад
          </Button>
        )}
      </div>
      <div className="warehouse-layout">
        <div className="warehouse-cards">
          {data.warehouses.map((w) => {
            const qty = preview
              ? w.stock
              : (data.stocks || [])
                  .filter((s) => s.warehouse === w.id)
                  .reduce((sum, s) => sum + Number(s.quantity), 0);
            return (
              <section className="panel warehouse-card" key={w.id}>
                <div className="warehouse-heading">
                  <Tile>
                    <Home size={25} />
                  </Tile>
                  <span>
                    {w.name}
                    <small>{w.address}</small>
                  </span>
                  {admin && (
                    <IconButton
                      icon={PencilLine}
                      label={`Редагувати ${w.name}`}
                      onClick={() => editWarehouse(w)}
                    />
                  )}
                </div>
                <div className="capacity-label">
                  <span>Заповненість</span>
                  <span>
                    {w.capacity
                      ? Math.round((qty / w.capacity) * 100) + "%"
                      : "—"}
                  </span>
                </div>
                <div className="capacity-track">
                  <i
                    style={{
                      width: `${w.capacity ? Math.min(100, (qty / w.capacity) * 100) : 0}%`,
                    }}
                  />
                </div>
                <small>
                  {fmt(qty)} {w.capacity ? `із ${fmt(w.capacity)}` : ""} од.
                </small>
                <div className="warehouse-stats">
                  <div>
                    <strong>
                      {preview
                        ? w.workers
                        : data.users.filter(
                            (u) =>
                              roleOf(u) === "worker" &&
                              u.memberships?.some((m) => m.warehouse === w.id),
                          ).length}
                    </strong>
                    <small>комірники</small>
                  </div>
                  <div>
                    <strong>
                      {preview
                        ? w.documents
                        : data.documents.filter((d) => d.warehouse === w.id)
                            .length}
                    </strong>
                    <small>документів</small>
                  </div>
                  <div>
                    <strong className={w.queue ? "amber" : "green-text"}>
                      {preview ? w.queue : "—"}
                    </strong>
                    <small>у черзі</small>
                  </div>
                </div>
                <div className="warehouse-footer">
                  <span>
                    Менеджер:{" "}
                    {w.manager ||
                      data.users.find((u) =>
                        u.memberships?.some(
                          (m) => m.warehouse === w.id && m.role === "manager",
                        ),
                      )?.name ||
                      "—"}
                  </span>
                  <button
                    className="text-button"
                    onClick={() => {
                      setWarehouse(String(w.id));
                      go("catalog");
                    }}
                  >
                    Залишки
                  </button>
                </div>
              </section>
            );
          })}
        </div>
        <section className="panel warehouse-table">
          <Table
            headers={[
              "Категорія",
              ...data.warehouses.map((w) => w.name),
              "Усього",
            ]}
          >
            {categories.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                {data.warehouses.map((w, i) => (
                  <td key={w.id}>
                    {preview
                      ? fmt(
                          ([
                            [320, 131, 81],
                            [104, 44, 28],
                            [205, 84, 53],
                            [467, 187, 118],
                            [226, 91, 57],
                            [84, 34, 21],
                            [517, 207, 130],
                          ][c.id - 1] || [0, 0, 0])[i],
                        )
                      : fmt(
                          (data.stocks || [])
                            .filter(
                              (s) =>
                                s.warehouse === w.id &&
                                data.products.some(
                                  (p) =>
                                    p.id === s.product &&
                                    (p.category_id === c.id ||
                                      p.category === c.name),
                                ),
                            )
                            .reduce((sum, s) => sum + Number(s.quantity), 0),
                        )}
                  </td>
                ))}
                <td>{fmt(c.stock)}</td>
              </tr>
            ))}
          </Table>
          <div className="table-bottom-space" />
        </section>
      </div>
    </>
  );
}
