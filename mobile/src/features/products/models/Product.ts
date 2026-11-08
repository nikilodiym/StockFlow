/** Mapping between the `products` SQLite table and the Product type. */
import { TABLES } from '../../../database/schema';
import type { Product, ServerProduct } from '../types/product.types';

type ProductRow = {
    id: number;
    sku: string | null;
    barcode: string | null;
    name: string | null;
    unit: string | null;
    stock: number | null;
    server_id?: number | null;
};

export const ProductModel = {
    table: TABLES.products,

    fromRow(row: ProductRow): Product {
        return {
            id: row.id,
            sku: row.sku ?? '',
            barcode: row.barcode ?? '',
            name: row.name ?? '',
            unit: row.unit || 'шт',
            stock: Number(row.stock ?? 0),
            server_id: row.server_id ?? null,
        };
    },

    /** Local column values from a server product (pull). */
    fromServer(product: ServerProduct): Omit<Product, 'id'> {
        return {
            sku: product.sku,
            barcode: product.barcode || '',
            name: product.name,
            unit: product.unit || 'шт',
            stock: Number(product.stock) || 0,
            server_id: product.id,
        };
    },
};
