/** Mapping for `lines` joined with `products` (one scanned product of a document). */
import { TABLES } from '../../../database/schema';
import { ProductModel } from '../../products/models/Product';
import type { DocumentItem } from '../types/document.types';

type LineRow = {
    id: number;
    sku: string | null;
    barcode: string | null;
    name: string | null;
    stock: number | null;
    unit: string | null;
    quantity: number;
    line_id: number;
    server_id?: number | null;
};

export const DocumentLineModel = {
    table: TABLES.lines,

    /** SELECT used for both the current and saved documents. */
    selectSql: `SELECT products.id AS id, products.sku AS sku, products.barcode AS barcode, products.name AS name,
                       products.stock AS stock, products.server_id AS server_id,
                       lines.unit AS unit, lines.quantity AS quantity, lines.id AS line_id
                FROM lines LEFT JOIN products ON products.id = lines.product_id
                WHERE lines.document_id = ? ORDER BY lines.id`,

    fromRow(row: LineRow): DocumentItem {
        return { ...ProductModel.fromRow(row), unit: row.unit || 'шт', quantity: Number(row.quantity), line_id: row.line_id };
    },
};
