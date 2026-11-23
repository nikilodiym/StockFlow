/** One notification with "Позначити прочитаним". */
import { useAdmin } from "../../../app/state/AdminProvider";
import { Button } from "../../../shared/ui";
import { markRead } from "../api";

export default function NotificationModal() {
  const { modal, setData, setError, preview, close } = useAdmin();
  const item = modal.item;
  const read = async () => {
    try {
      if (!preview) await markRead(item.id);
      setData((d) => ({
        ...d,
        notifications: d.notifications.filter((n) => n.id !== item.id),
      }));
      close();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <>
      <p>{item.body}</p>
      <div className="modal-footer">
        <Button tone="primary" onClick={read}>
          Позначити прочитаним
        </Button>
      </div>
    </>
  );
}
