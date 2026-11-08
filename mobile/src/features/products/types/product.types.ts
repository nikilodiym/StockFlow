/** Product as stored on the phone. */
export type Product = {
    id: number;
    sku: string;
    barcode: string;
    name: string;
    unit: string;
    stock: number;
    /** Id of the same product on the server (set by sync pull). */
    server_id?: number | null;
};

/** One parsed row of an imported CSV (SKU,Barcode,Name,Unit,Stock). */
export type ProductCsvRow = {
    sku: string;
    barcode: string;
    name: string;
    unit: string;
    stock: number;
};

/** Product as returned by GET /api/sync/pull/. */
export type ServerProduct = {
    id: number;
    sku: string;
    name: string;
    unit: string;
    barcode: string;
    stock: string | number;
    is_active: boolean;
};
