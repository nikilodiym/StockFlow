/** "Нова одиниця виміру" / "Редагувати одиницю виміру". */
import FormFooter, { saveLabel } from "../../../app/modals/FormFooter";
import useFormField from "../../../app/modals/useFormField";
import useModalAction from "../../../app/modals/useModalAction";
import { useAdmin } from "../../../app/state/AdminProvider";
import { Field } from "../../../shared/ui";

export default function UnitModal() {
  const { modal, form, preview, mutate, say } = useAdmin();
  const patch = useFormField();
  const run = useModalAction();
  const item = modal.item;

  const save = (e) => {
    e.preventDefault();
    run(
      async () => {
        await mutate(
          "units",
          item,
          {
            name: form.name.trim(),
            code: form.code.trim(),
            ...(preview ? { count: item?.count || 0 } : {}),
          },
          item ? "PATCH" : "POST",
        );
        say("Одиницю виміру збережено");
      },
      { fallbackError: "Не вдалося зберегти зміни" },
    );
  };

  return (
    <form onSubmit={save} className="modal-form">
      <Field label="Позначення">
        <input required value={form.code || ""} onChange={(e) => patch("code", e.target.value)} />
      </Field>
      <Field label="Назва">
        <input required value={form.name || ""} onChange={(e) => patch("name", e.target.value)} />
      </Field>
      <FormFooter submitLabel={saveLabel(item)} />
    </form>
  );
}
