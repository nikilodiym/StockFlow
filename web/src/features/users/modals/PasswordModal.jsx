/** "Змінити пароль" (also answers a password-reset request in preview mode). */
import FormFooter from "../../../app/modals/FormFooter";
import useFormField from "../../../app/modals/useFormField";
import useModalAction from "../../../app/modals/useModalAction";
import { useAdmin } from "../../../app/state/AdminProvider";
import { request } from "../../../shared/api/client";
import { Field } from "../../../shared/ui";

export default function PasswordModal() {
  const { modal, form, setData, preview, say } = useAdmin();
  const patch = useFormField();
  const run = useModalAction();
  const item = modal.item;

  const save = (e) => {
    e.preventDefault();
    run(
      async () => {
        if (!preview)
          await request(`/users/${item.id}/`, {
            method: "PATCH",
            body: JSON.stringify({ password: form.password }),
          });
        if (preview && modal.requestId)
          setData((d) => ({
            ...d,
            requests: d.requests.filter((r) => r.id !== modal.requestId),
          }));
        say("Пароль змінено");
      },
      { fallbackError: "Не вдалося зберегти зміни" },
    );
  };

  return (
    <form onSubmit={save} className="modal-form">
      <p>
        {item.name} · {item.email}
      </p>
      <Field label="Новий пароль">
        <input
          required
          type="password"
          minLength={8}
          autoComplete="new-password"
          value={form.password || ""}
          onChange={(e) => patch("password", e.target.value)}
        />
      </Field>
      <small>Щонайменше 8 символів. Використайте літери та цифри.</small>
      <FormFooter submitLabel="Зберегти" />
    </form>
  );
}
