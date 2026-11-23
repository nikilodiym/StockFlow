/** "Новий акаунт" / "Редагувати акаунт": name, email, role, warehouse. */
import FormFooter, { saveLabel } from "../../../app/modals/FormFooter";
import useFormField from "../../../app/modals/useFormField";
import useModalAction, { KEEP_OPEN } from "../../../app/modals/useModalAction";
import { useAdmin } from "../../../app/state/AdminProvider";
import { roles } from "../../../shared/lib/dictionaries";
import { Field, Select } from "../../../shared/ui";
import { temporaryPassword } from "../model";

export default function UserModal() {
  const { modal, setModal, form, setForm, data, preview, user, mutate, say } = useAdmin();
  const patch = useFormField();
  const run = useModalAction();
  const item = modal.item;

  const save = (e) => {
    e.preventDefault();
    run(
      async () => {
        const password = temporaryPassword();
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
                  warehouse_name: data.warehouses.find((w) => String(w.id) === String(form.warehouse))
                    ?.name,
                },
              ]
            : [],
        };
        delete demoPayload.password;
        const saved = await mutate("users", item, preview ? demoPayload : payload, item ? "PATCH" : "POST");
        if (!item) {
          // Show the temporary password once.
          setModal({ kind: "created", item: saved });
          setForm({ password });
          return KEEP_OPEN;
        }
        say("Акаунт оновлено");
      },
      { fallbackError: "Не вдалося зберегти зміни" },
    );
  };

  return (
    <form onSubmit={save} className="modal-form">
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
          <Select value={form.role} disabled={item?.id === user.id} onChange={(e) => patch("role", e.target.value)}>
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
          Тимчасовий пароль буде створено автоматично. Передайте його користувачу особисто.
        </div>
      )}
      <FormFooter submitLabel={item ? saveLabel(item) : "Створити акаунт"} />
    </form>
  );
}
