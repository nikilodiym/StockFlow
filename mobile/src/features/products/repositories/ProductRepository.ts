/** Access to products in the local SQLite database. */
import type { SQLiteDatabase } from 'expo-sqlite';
import { ProductModel } from '../models/Product';
import type { Product, ProductCsvRow, ServerProduct } from '../types/product.types';

export const ProductRepository = {
    async getAll(db: SQLiteDatabase): Promise<Product[]> {
        const rows = await db.getAllAsync<Product>('SELECT * FROM products ORDER BY name');
        return rows.map(ProductModel.fromRow);
    },

    /** Exact barcode / SKU match or name contains the term. */
    async findOne(db: SQLiteDatabase, term: string): Promise<Product | null> {
        const row = await db.getFirstAsync<Product>(
            'SELECT * FROM products WHERE barcode = ? OR sku = ? OR name LIKE ? LIMIT 1',
            [term, term, `%${term}%`],
        );
        return row ? ProductModel.fromRow(row) : null;
    },

    /** Insert or update by SKU/barcode (CSV import). */
    async upsertFromCsv(db: SQLiteDatabase, row: ProductCsvRow): Promise<void> {
        const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM products WHERE sku = ? OR barcode = ? LIMIT 1', [row.sku, row.barcode]);
        if (existing) {
            await db.runAsync('UPDATE products SET sku=?,barcode=?,name=?,unit=?,stock=? WHERE id=?', [row.sku, row.barcode, row.name, row.unit, row.stock, existing.id]);
        } else {
            await db.runAsync('INSERT INTO products (sku,barcode,name,unit,stock) VALUES (?,?,?,?,?)', [row.sku, row.barcode, row.name, row.unit, row.stock]);
        }
    },

    /** Insert or update by SKU from the server catalog; remembers the server id. */
    async upsertFromServer(db: SQLiteDatabase, product: ServerProduct): Promise<void> {
        const p = ProductModel.fromServer(product);
        const existing = await db.getFirstAsync<{ id: number }>('SELECT id FROM products WHERE sku = ? LIMIT 1', [p.sku]);
        if (existing) {
            await db.runAsync('UPDATE products SET barcode=?,name=?,unit=?,stock=?,server_id=? WHERE id=?', [p.barcode, p.name, p.unit, p.stock, p.server_id ?? null, existing.id]);
        } else {
            await db.runAsync('INSERT INTO products (sku,barcode,name,unit,stock,server_id) VALUES (?,?,?,?,?,?)', [p.sku, p.barcode, p.name, p.unit, p.stock, p.server_id ?? null]);
        }
    },

    /** local product id → server product id (for products the server knows). */
    async serverIdMap(db: SQLiteDatabase): Promise<Map<number, number>> {
        const rows = await db.getAllAsync<{ id: number; server_id: number }>('SELECT id, server_id FROM products WHERE server_id IS NOT NULL');
        return new Map(rows.map(row => [row.id, row.server_id]));
    },
};
