/**
 * Data from the server: loads every collection the user may see, keeps it in one
 * object and applies changes (mutate). In preview mode the same API works on demo data.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { clearSession, getAll, request } from "../../shared/api/client";
import { emptyData, resourcesFor } from "../../shared/api/resources";
import { syncEvents } from "../../features/sync/model";
import { markConflicts } from "../../features/documents/model";
import { previewData, savePreviewData } from "./preview";

export default function useAdminData({ preview, user, setUser, admin, warehouse }) {
  const [data, setData] = useState(() => (preview ? previewData() : emptyData));
  const [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState("");
  const loadSequence = useRef(0);

  useEffect(() => {
    if (preview) savePreviewData(data);
  }, [data, preview]);

  const load = useCallback(async () => {
    if (preview || !user) return;
    const sequence = ++loadSequence.current;
    setLoading(true);
    setLoadError("");
    const resources = resourcesFor({ admin, warehouse });
    const results = await Promise.allSettled(
      resources.map(async ([key, url]) => [key, await getAll(url)]),
    );
    if (sequence !== loadSequence.current) return; // a newer load started
    const failures = results.flatMap((r, i) =>
      r.status === "rejected" ? [`${resources[i][0]}: ${r.reason.message}`] : [],
    );
    setData((current) => {
      const next = { ...current };
      results.forEach((r) => {
        if (r.status === "fulfilled") next[r.value[0]] = r.value[1];
      });
      next.documents = markConflicts(next.documents, next.conflicts);
      next.events = syncEvents(next.batches);
      return next;
    });
    if (results.some((r) => r.status === "rejected" && r.reason.status === 401)) {
      clearSession();
      setUser(null);
    } else if (failures.length)
      setLoadError("Частину даних не завантажено. " + failures.join("; "));
    setLoading(false);
  }, [preview, user, admin, warehouse, setUser]);

  useEffect(() => {
    load();
    return () => {
      loadSequence.current++;
    };
  }, [load]);

  /** Create (no item), update (PATCH) or delete one record and update the local copy. */
  const mutate = async (collection, item, payload, method = "POST") => {
    const apply = (saved) =>
      setData((d) => ({
        ...d,
        [collection]:
          method === "DELETE"
            ? d[collection].filter((x) => x.id !== item.id)
            : item
              ? d[collection].map((x) => (x.id === item.id ? saved : x))
              : [...d[collection], saved],
      }));
    if (preview) {
      const saved = { ...item, ...payload, id: item?.id || crypto.randomUUID() };
      apply(saved);
      return saved;
    }
    const result = await request(`/${collection}/${item ? item.id + "/" : ""}`, {
      method,
      body: method === "DELETE" ? undefined : JSON.stringify(payload),
    });
    apply(result);
    return result;
  };

  const reset = () => setData(emptyData);

  return { data, setData, load, loading, setLoading, loadError, mutate, reset };
}
