/** "Акаунт створено": shows the temporary password once. */
import { useAdmin } from "../../../app/state/AdminProvider";
import { Button } from "../../../shared/ui";

export default function CreatedModal() {
  const { modal, form, close } = useAdmin();
  const item = modal.item;
  return (
    <>
      <p>
        {item.name} · {item.code || String(item.id).slice(0, 8)}
      </p>
      <p>
        Тимчасовий пароль: <strong className="credential">{form.password}</strong>
        <br />
        Передайте його особисто.
      </p>
      <div className="modal-footer">
        <Button tone="primary" onClick={close}>
          Зрозуміло
        </Button>
      </div>
    </>
  );
}
