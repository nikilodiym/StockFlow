import { useEffect, useState } from "react";
import { fetchDashboardStats } from "../api";

/**
 * Dashboard statistics of the selected warehouse (scans, workers). Reloads when the warehouse
 * changes and after every data reload (`version`), so new documents show up right away.
 * Preview mode has no server: returns { stats: null } and the page uses demo values.
 */
export default function useDashboardStats({ preview, warehouse, version }) {
  const [state, setState] = useState({ stats: null, loading: !preview, error: "" });

  useEffect(() => {
    if (preview) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: "" }));
    fetchDashboardStats(warehouse)
      .then((stats) => !cancelled && setState({ stats, loading: false, error: "" }))
      .catch(
        (error) =>
          !cancelled && setState({ stats: null, loading: false, error: error.message }),
      );
    return () => {
      cancelled = true;
    };
  }, [preview, warehouse, version]);

  return state;
}
