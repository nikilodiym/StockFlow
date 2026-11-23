/** Block / unblock an account. */
import useModalAction from "../../../app/modals/useModalAction";
import { useAdmin } from "../../../app/state/AdminProvider";
import { Button } from "../../../shared/ui";

export default function BlockModal() {
  const { modal, loading, close, mutate, say } = useAdmin();
  const run = useModalAction();
  const item = modal.item;
  const confirm = () =>
    run(async () => {
      await mutate("users", item, { is_active: !item.is_active }, "PATCH");
      say(item.is_active ? "Акаунт заблоковано" : "Акаунт розблоковано");
    });
  return (
    <>
      <p>
        {item.name}{" "}
        {item.is_active
          ? "не зможе увійти в застосунок і панель. Незавершені чернетки лишаться на пристрої."
          : "знову зможе входити в застосунок і панель."}
      </p>
      <div className="modal-footer">
        <Button onClick={close} disabled={loading}>
          Скасувати
        </Button>
        <Button tone={item.is_active ? "danger" : "primary"} onClick={confirm} disabled={loading}>
          {item.is_active ? "Заблокувати" : "Розблокувати"}
        </Button>
      </div>
    </>
  );
}
