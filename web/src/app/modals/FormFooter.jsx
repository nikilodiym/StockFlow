/** Footer of form dialogs: optional extra action on the left, Cancel and the submit button. */
import { Button } from "../../shared/ui";
import { useAdmin } from "../state/AdminProvider";

export default function FormFooter({ submitLabel, extra = null }) {
  const { loading, close } = useAdmin();
  return (
    <div className="modal-footer">
      {extra}
      <span />
      <Button onClick={close} disabled={loading}>
        Скасувати
      </Button>
      <button className="button primary" disabled={loading}>
        {loading ? "Збереження…" : submitLabel}
      </button>
    </div>
  );
}

/** "Зберегти" for an existing record, "Створити" for a new one. */
export const saveLabel = (item) => (item ? "Зберегти" : "Створити");
