/**
 * Server collections loaded by the admin panel (paths relative to the API base).
 * One place to change an endpoint instead of searching through components.
 */
export function resourcesFor({ admin, warehouse }) {
  return [
    [
      "products",
      "/products/?ordering=sku" + (warehouse ? "&warehouse=" + warehouse : ""),
    ],
    ["categories", "/categories/"],
    ["units", "/units/"],
    ["warehouses", "/warehouses/"],
    ["documents", "/documents/"],
    ["notifications", "/notifications/"],
    ["conflicts", "/sync/conflicts/"],
    ["batches", "/sync/batches/"],
    // API path is /stock/ (the panel used to request /stocks/, which does not exist)
    ["stocks", "/stock/"],
    ...(admin
      ? [
          ["users", "/users/"],
          ["devices", "/devices/"],
        ]
      : []),
  ];
}

/** Empty state of every collection (before the first load / after logout). */
export const emptyData = {
  products: [],
  categories: [],
  units: [],
  warehouses: [],
  users: [],
  documents: [],
  events: [],
  notifications: [],
  requests: [],
  conflicts: [],
  devices: [],
  stocks: [],
};
