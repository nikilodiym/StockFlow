/** Bell button with the dropdown list of notifications; a click opens the related place. */
import { Bell, KeyRound, TriangleAlert, WifiOff } from "lucide-react";
import { useAdmin } from "../../../app/state/AdminProvider";
import { Empty, Tile } from "../../../shared/ui";
import { firstConflict } from "../../documents/model";

export default function NotificationsMenu({ isOpen, onToggle, onClose }) {
  const { data, open, go, setUserTab, setLow } = useAdmin();
  const unread = data.notifications.filter((n) => !n.read_at).length;

  function select(n) {
    onClose();
    if (n.target === "conflict") open("document", firstConflict(data.documents));
    else if (n.target === "requests") {
      go("users");
      setUserTab("requests");
    } else if (n.target === "low") {
      go("catalog");
      setLow(true);
    } else if (n.target === "sync") open("sync");
    else open("notification", n);
  }

  return (
    <div className="notification-anchor">
      <button className="bell-button" aria-label="Сповіщення" aria-expanded={isOpen} onClick={onToggle}>
        <Bell size={25} strokeWidth={1.8} />
        {unread > 0 && <span>{unread}</span>}
      </button>
      {isOpen && (
        <div className="notification-menu">
          <h2>Сповіщення</h2>
          {data.notifications.length ? (
            data.notifications.map((n) => {
              const Icon =
                n.target === "low"
                  ? TriangleAlert
                  : n.kind === "error"
                    ? WifiOff
                    : n.kind === "warning"
                      ? KeyRound
                      : TriangleAlert;
              return (
                <button key={n.id} onClick={() => select(n)}>
                  <Tile tone={n.kind === "warning" ? "yellow" : "red"}>
                    <Icon size={27} />
                  </Tile>
                  <span>
                    {n.title}
                    <small>{n.body}</small>
                  </span>
                </button>
              );
            })
          ) : (
            <Empty>Нових сповіщень немає.</Empty>
          )}
        </div>
      )}
    </div>
  );
}
