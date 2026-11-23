/** "Вийти з акаунта?" */
import useModalAction, { KEEP_OPEN } from "../../../app/modals/useModalAction";
import { useAdmin } from "../../../app/state/AdminProvider";
import { Button } from "../../../shared/ui";
import { logout } from "../api";

export default function LogoutModal() {
  const { preview, loading, close, setUser, reset } = useAdmin();
  const run = useModalAction();
  const confirm = () =>
    run(async () => {
      await logout({ preview });
      if (preview) {
        location.href = "/";
        return KEEP_OPEN;
      }
      setUser(null);
      reset();
    });
  return (
    <>
      <p>Сесію буде завершено. Незбережені зміни у формах зникнуть.</p>
      <div className="modal-footer">
        <Button onClick={close} disabled={loading}>
          Скасувати
        </Button>
        <Button tone="primary" onClick={confirm} disabled={loading}>
          Вийти
        </Button>
      </div>
    </>
  );
}
