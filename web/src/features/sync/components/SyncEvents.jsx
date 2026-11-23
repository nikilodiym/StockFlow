/** Sync journal list (dashboard panel and the "Журнал синхронізацій" drawer). */
import { CircleCheck, TriangleAlert, WifiOff } from "lucide-react";
import { useAdmin } from "../../../app/state/AdminProvider";
import { Empty, Tile } from "../../../shared/ui";
import { firstConflict } from "../../documents/model";

export default function SyncEvents({ compact = false }) {
  const { data, open } = useAdmin();
  return (
    <div className={`events ${compact ? "compact" : ""}`}>
      {data.events.length ? (
        data.events.map((e) => {
          const Icon = e.kind === "error" ? WifiOff : e.kind === "conflict" ? TriangleAlert : CircleCheck;
          return (
            <button
              className="event-row"
              key={e.id}
              onClick={() =>
                e.kind === "conflict" && data.documents.some((d) => d.status === "conflict")
                  ? open("document", firstConflict(data.documents))
                  : !compact && open("sync")
              }
            >
              <Tile tone={e.kind === "success" ? "" : "red"}>
                <Icon size={24} strokeWidth={1.6} />
              </Tile>
              <span className="event-copy">
                <span>{e.title}</span>
                <small>{e.body}</small>
              </span>
              <span className="event-time">
                {e.time}
                <small>{e.date}</small>
              </span>
            </button>
          );
        })
      ) : (
        <Empty>Синхронізацій ще немає.</Empty>
      )}
    </div>
  );
}
