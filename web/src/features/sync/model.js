/** Sync journal rows (dashboard "events") built from server sync batches. */
import { dateParts } from "../../shared/lib/format";

export function syncEvents(batches = []) {
  return batches.map((b) => ({
    id: b.id,
    title: b.items_conflict
      ? "Конфлікт синхронізації"
      : b.items_failed
        ? "Помилка синхронізації"
        : "Синхронізовано",
    body: `${b.user_name || "Користувач"} · ${b.device_name || ""} · ${b.items_ok} записів`,
    kind: b.items_conflict ? "conflict" : b.items_failed ? "error" : "success",
    time: dateParts(b.received_at)[1],
    date: dateParts(b.received_at)[0],
  }));
}
