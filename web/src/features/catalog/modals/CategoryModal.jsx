/** "Нова категорія" / "Редагувати категорію". */
import FormFooter, { saveLabel } from "../../../app/modals/FormFooter";
import useFormField from "../../../app/modals/useFormField";
import useModalAction from "../../../app/modals/useModalAction";
import { useAdmin } from "../../../app/state/AdminProvider";
import { Field } from "../../../shared/ui";

export default function CategoryModal() {
  const { modal, form, preview, mutate, say } = useAdmin();
  const patch = useFormField();
  const run = useModalAction();
  const item = modal.item;

  const save = (e) => {
    e.preventDefault();
    run(
      async () => {
        await mutate("categories", item, preview ? form : { name: form.name.trim() }, item ? "PATCH" : "POST");
        say("Категорію збережено");
      },
      { fallbackError: "Не вдалося зберегти зміни" },
    );
  };

  return (
    <form onSubmit={save} className="modal-form">
      <Field label="Назва">
        <input required value={form.name || ""} onChange={(e) => patch("name", e.target.value)} />
      </Field>
      <Field label="Префікс SKU">
        <input
          value={form.prefix || ""}
          onChange={(e) => patch("prefix", e.target.value.toUpperCase())}
          disabled={!preview || !!item}
          maxLength={8}
        />
      </Field>
      {!preview && <small>Префікс відображається за SKU товарів категорії.</small>}
      <FormFooter submitLabel={saveLabel(item)} />
    </form>
  );
}
