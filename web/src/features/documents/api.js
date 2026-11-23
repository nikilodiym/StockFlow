import { request } from "../../shared/api/client";

/** decision: "kept_local" | "kept_server" */
export const resolveConflict = (conflictId, decision) =>
  request(`/sync/conflicts/${conflictId}/resolve/`, {
    method: "POST",
    body: JSON.stringify({ decision }),
  });
