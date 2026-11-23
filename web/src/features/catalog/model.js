/** Catalog helpers: category statistics and initial values of the catalog forms. */

/** Categories with SKU prefix, number of products and total stock. */
export function categoriesWithStats(categories, products, preview) {
  return categories.map((c) => {
    const own = products.filter(
      (p) => p.category_id === c.id || p.category === c.name,
    );
    return {
      ...c,
      prefix:
        c.prefix ||
        products.find((p) => p.category_id === c.id)?.sku?.split("-")[0] ||
        "—",
      count: preview ? c.count : own.length,
      stock: preview ? c.stock : own.reduce((a, p) => a + Number(p.stock), 0),
    };
  });
}

/** Form values for "Новий товар" / "Редагувати товар". */
export function productFormValues(product, data) {
  return product
    ? {
        ...product,
        unit:
          data.units.find(
            (u) =>
              u.id === product.base_unit ||
              u.code === product.unit ||
              u.name === product.unit,
          )?.code || product.unit,
        barcodesList:
          product.barcodes?.filter((b) => b.is_active).map((b) => b.code) ||
          [product.barcode].filter(Boolean),
      }
    : {
        name: "",
        sku: "",
        min_stock: 5,
        category_id: data.categories[0]?.id || "",
        unit: data.units[0]?.code || "шт",
        barcodesList: [],
        barcodeInput: "",
      };
}

export const categoryFormValues = (c) => c || { name: "", prefix: "" };
export const unitFormValues = (u) => u || { name: "", code: "" };

export const BARCODE_PATTERN = /^\d{8,14}$/;
