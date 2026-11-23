/** Filters shared between pages: selected warehouse, search, page of a table, "below minimum", users tab. */
import { useEffect, useState } from "react";

export default function useFilters({ user, initialWarehouse = "" }) {
  const [warehouse, setWarehouse] = useState(initialWarehouse),
    [query, setQuery] = useState(""),
    [pagination, setPagination] = useState(1),
    [low, setLow] = useState(false),
    [userTab, setUserTab] = useState("accounts");

  // Back to the first page whenever the visible set changes.
  useEffect(() => setPagination(1), [query, warehouse, low]);

  // A manager of a single warehouse always works on it.
  useEffect(() => {
    if (user && !user.is_staff && user.memberships?.length === 1)
      setWarehouse(String(user.memberships[0].warehouse));
  }, [user]);

  return {
    warehouse,
    setWarehouse,
    query,
    setQuery,
    pagination,
    setPagination,
    low,
    setLow,
    userTab,
    setUserTab,
  };
}
