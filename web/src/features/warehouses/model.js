/** Warehouses helpers. */

export const warehouseFormValues = (w) =>
  w || { name: "", address: "", code: "", capacity: 6000, manager: "" };

/** Demo per-category stock of each warehouse (preview mode only). */
export const PREVIEW_CATEGORY_STOCK = [
  [320, 131, 81],
  [104, 44, 28],
  [205, 84, 53],
  [467, 187, 118],
  [226, 91, 57],
  [84, 34, 21],
  [517, 207, 130],
];
