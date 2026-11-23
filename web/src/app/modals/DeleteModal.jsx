/** Confirmation for deleting any record (product, category, unit, warehouse). */
import { Button } from "../../shared/ui";
import { useAdmin } from "../state/AdminProvider";
import useModalAction from "./useModalAction";

export default function DeleteModal() {
  const { modal, loading, close, mutate, say } = useAdmin();
  const run = useModalAction();
  const item = modal.item;
  const confirm = () =>
    run(async () => {
      await mutate(modal.collection, item, {}, "DELETE");
      say("Видалено");
    });
  return (
    <>
      <p>
        {item.name}
        {item.sku ? ` (${item.sku})` : ""} зникне з{" "}
        {modal.collection === "products"
          ? "каталогу на всіх складах і на пристроях після синхронізації."
          : "активного списку."}
      </p>
      <div className="modal-footer">
        <Button onClick={close} disabled={loading}>
          Скасувати
        </Button>
        <Button tone="danger" onClick={confirm} disabled={loading}>
          Видалити
        </Button>
      </div>
    </>
  );
}
