/** "Новий склад" / "Редагувати склад". */
import FormFooter, { saveLabel } from "../../../app/modals/FormFooter";
import useFormField from "../../../app/modals/useFormField";
import useModalAction from "../../../app/modals/useModalAction";
import { useAdmin } from "../../../app/state/AdminProvider";
import { roleOf } from "../../../shared/lib/roles";
import { Button, Field, Select } from "../../../shared/ui";

export default function WarehouseModal() {
  const { modal, setModal, form, data, preview, mutate, say } = useAdmin();
  const patch = useFormField();
  const run = useModalAction();
  const item = modal.item;

  const save = (e) => {
    e.preventDefault();
    run(
      async () => {
        await mutate(
          "warehouses",
          item,
          preview
            ? form
            : {
                name: form.name.trim(),
                address: form.address.trim(),
                code: form.code.trim() || item?.code || "WH-" + crypto.randomUUID().slice(0, 8),
              },
          item ? "PATCH" : "POST",
        );
        say("Склад збережено");
      },
      { fallbackError: "Не вдалося зберегти зміни" },
    );
  };

  return (
    <form onSubmit={save} className="modal-form">
      <Field label="Назва">
        <input required value={form.name || ""} onChange={(e) => patch("name", e.target.value)} />
      </Field>
      <Field label="Адреса">
        <input value={form.address || ""} onChange={(e) => patch("address", e.target.value)} />
      </Field>
      <div className="form-grid">
        <Field label="Менеджер">
          <Select value={form.manager || ""} disabled={!preview} onChange={(e) => patch("manager", e.target.value)}>
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
            onChange={(e) => patch("capacity", Number(e.target.value))}
          />
        </Field>
      </div>
      {!preview && (
        <small>
          Місткість потребує підтримки API. Менеджер призначається через акаунт користувача.
        </small>
      )}
      <FormFooter
        submitLabel={saveLabel(item)}
        extra={
          item && (
            <Button
              tone="outline-danger"
              onClick={() => setModal({ kind: "delete", item, collection: "warehouses" })}
            >
              Видалити
            </Button>
          )
        }
      />
    </form>
  );
}
