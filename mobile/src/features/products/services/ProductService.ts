/** Product business logic: search, CSV import/export. Pure functions are exported for tests. */
import type { SQLiteDatabase } from 'expo-sqlite';
import { csvCell } from '../../../utils/formatters';
import { ProductRepository } from '../repositories/ProductRepository';
import type { Product, ProductCsvRow } from '../types/product.types';

export const CSV_HEADER = 'SKU,Barcode,Name,Unit,Stock';

/** Search in the already loaded list: barcode, SKU (any case) or part of the name. */
export function matchProduct(products: Product[], term: string): Product | undefined {
    const value = term.toLowerCase();
    return products.find(
        (p) => p.barcode === term || p.sku.toLowerCase() === value || p.name.toLowerCase().includes(value),
    );
}

/** Text filter for the "quick pick" list. */
export function filterProducts(products: Product[], query: string): Product[] {
    const value = query.toLowerCase();
    return products.filter((p) => `${p.name} ${p.sku} ${p.barcode}`.toLowerCase().includes(value));
}

/** CSV with header SKU,Barcode,Name,Unit,Stock → rows (rows without SKU or name are skipped). */
export function parseProductsCsv(text: string): ProductCsvRow[] {
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    const rows: ProductCsvRow[] = [];
    for (const line of lines.slice(1)) {
        const [sku, barcode, name, unit, stockText] = line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
        if (!sku || !name) continue;
        rows.push({
            sku,
            barcode: barcode || '',
            name,
            unit: unit || 'шт',
            stock: Number(String(stockText || '0').replace(',', '.')) || 0,
        });
    }
    return rows;
}

export function productsToCsv(products: Product[]): string {
    return [CSV_HEADER, ...products.map((p) => [p.sku, p.barcode, csvCell(p.name), p.unit, p.stock].join(','))].join(
        '\n',
    );
}

export const ProductService = {
    /** A scan must not match an unrelated SKU or digits in a product name. */
    async findByBarcode(db: SQLiteDatabase, products: Product[], barcode: string): Promise<Product | null> {
        return products.find((p) => p.barcode === barcode) ?? (await ProductRepository.findByBarcode(db, barcode));
    },
    /** Loaded list first, then the database. */
    async find(db: SQLiteDatabase, products: Product[], term: string): Promise<Product | null> {
        return matchProduct(products, term) ?? (await ProductRepository.findOne(db, term));
    },

    /** Returns how many products were added or updated. */
    async importCsv(db: SQLiteDatabase, text: string): Promise<number> {
        const rows = parseProductsCsv(text);
        for (const row of rows) await ProductRepository.upsertFromCsv(db, row);
        return rows.length;
    },
};
