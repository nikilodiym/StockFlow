/** Demo catalog so the app works offline before the first sync. */
import type { SQLiteDatabase } from 'expo-sqlite';

/** Barcode of DRK-001; also printed on src/assets/images/emulator-test-ean13.png for the emulator camera. */
export const TEST_BARCODE = '4820000000017';

export const LOCAL_SEED: [sku: string, barcode: string, name: string, unit: string, stock: number][] = [
    ['DRK-001', TEST_BARCODE, 'Вода мінеральна 1.5 л', 'шт', 128],
    ['DRK-002', '4820000000012', 'Сік апельсиновий 1 л', 'шт', 42],
    ['FOO-001', '4820000000013', 'Кава зернова 1 кг', 'упак', 18],
    ['FOO-002', '4820000000014', 'Рис довгозернистий 1 кг', 'упак', 7],
    ['HOM-001', '4820000000015', 'Рушники паперові 2 шт', 'упак', 34],
];

export async function seedIfEmpty(db: SQLiteDatabase): Promise<void> {
    const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM products');
    if (!row || row.n === 0) {
        for (const product of LOCAL_SEED) {
            await db.runAsync('INSERT INTO products (sku, barcode, name, unit, stock) VALUES (?, ?, ?, ?, ?)', product);
        }
    }
    // Older installs seeded DRK-001 with a different code.
    await db.runAsync('UPDATE products SET barcode = ? WHERE sku = ? AND barcode = ?', [TEST_BARCODE, 'DRK-001', '4820000000011']);
}
