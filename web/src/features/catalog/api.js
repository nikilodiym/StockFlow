/** Catalog requests that need more than a single CRUD call. */
import { request } from "../../shared/api/client";

/**
 * After saving a product: add the extra barcodes (the first one is sent as `barcode`)
 * and deactivate the ones the user removed.
 */
export async function syncProductBarcodes(product, previous, codes) {
  for (const code of codes
    .slice(1)
    .filter((code) => !previous?.barcodes?.some((b) => b.code === code && b.is_active)))
    await request("/barcodes/", {
      method: "POST",
      body: JSON.stringify({ product: product.id, code, is_primary: false }),
    });
  for (const b of previous?.barcodes || [])
    if (b.is_active && !codes.includes(b.code))
      await request(`/barcodes/${b.id}/`, { method: "DELETE" });
}

/** Upload a CSV/XLSX file to the server import (POST /imports/). */
export function uploadImport(file) {
  const body = new FormData();
  body.append("file", file);
  return request("/imports/", { method: "POST", body });
}
