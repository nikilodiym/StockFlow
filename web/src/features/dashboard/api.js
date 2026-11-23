import { request } from "../../shared/api/client";

/**
 * Everything the dashboard reads besides the shared collections: scans per hour today,
 * scans per day for 7 days and today's workers. `warehouse` = id or "" for every visible warehouse.
 */
export async function fetchDashboardStats(warehouse) {
  const scope = warehouse ? `warehouse=${encodeURIComponent(warehouse)}` : "";
  const [hours, days, workers] = await Promise.all([
    request(`/reports/scans-by-hour/?${scope}`),
    request(`/reports/scans-by-day/?days=7&${scope}`),
    request(`/reports/workers/?${scope}`),
  ]);
  return { hours, days, workers };
}
