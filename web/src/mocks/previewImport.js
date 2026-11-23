/** Preview mode: CSV import applied to demo products in the browser (no server). */

function splitCsvLine(line, delimiter) {
  const cells = [];
  let value = "",
    quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      cells.push(value);
      value = "";
    } else value += ch;
  }
  cells.push(value);
  return cells;
}

/** Returns { products, added } — demo products with the CSV rows upserted by SKU. */
export async function importPreviewCsv(file, data) {
  const text = (await file.text()).replace(/^﻿/, "");
  const lines = text.trim().split(/\r?\n/),
    delimiter = lines[0].includes(";") ? ";" : ",";
  let added = 0;
  const products = [...data.products],
    start = /штрих|barcode|sku/i.test(lines[0]) ? 1 : 0;
  for (let i = start; i < lines.length; i++) {
    const [barcode, sku, name, cat, unit] = splitCsvLine(lines[i], delimiter);
    if (!name || !sku) throw new Error(`Рядок ${i + 1}: потрібні назва та SKU`);
    const c = data.categories.find((c) => c.name === cat || c.prefix === cat);
    const value = {
      id: crypto.randomUUID(),
      barcode,
      sku,
      name,
      category: c?.name || cat,
      category_id: c?.id,
      unit: unit || "шт",
      stock: 0,
      min_stock: 5,
    };
    const existing = products.findIndex((p) => p.sku === sku);
    if (existing >= 0)
      products[existing] = { ...products[existing], ...value, id: products[existing].id };
    else products.push(value);
    added++;
  }
  return { products, added };
}
