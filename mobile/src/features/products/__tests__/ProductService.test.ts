import { filterProducts, matchProduct, parseProductsCsv, productsToCsv } from '../services/ProductService';
import type { Product } from '../types/product.types';

const products: Product[] = [
    { id: 1, sku: 'DRK-001', barcode: '4820000000017', name: 'Вода мінеральна 1.5 л', unit: 'шт', stock: 128 },
    { id: 2, sku: 'FOO-001', barcode: '4820000000013', name: 'Кава зернова 1 кг', unit: 'упак', stock: 18 },
];

describe('matchProduct', () => {
    it('finds by exact barcode', () => expect(matchProduct(products, '4820000000013')?.id).toBe(2));
    it('finds by SKU in any case', () => expect(matchProduct(products, 'drk-001')?.id).toBe(1));
    it('finds by part of the name', () => expect(matchProduct(products, 'кава')?.id).toBe(2));
    it('returns undefined when nothing matches', () => expect(matchProduct(products, 'чай')).toBeUndefined());
});

describe('filterProducts', () => {
    it('filters by name, SKU or barcode', () => {
        expect(filterProducts(products, 'FOO').map(p => p.id)).toEqual([2]);
        expect(filterProducts(products, '0017').map(p => p.id)).toEqual([1]);
        expect(filterProducts(products, '')).toHaveLength(2);
    });
});

describe('CSV', () => {
    it('parses rows, skips header and rows without SKU or name', () => {
        const rows = parseProductsCsv('SKU,Barcode,Name,Unit,Stock\nA-1,111,"Товар",кг,2.5\n,222,Без SKU,шт,1\nB-2,,Без коду,,\n');
        expect(rows).toEqual([
            { sku: 'A-1', barcode: '111', name: 'Товар', unit: 'кг', stock: 2.5 },
            { sku: 'B-2', barcode: '', name: 'Без коду', unit: 'шт', stock: 0 },
        ]);
    });

    it('exports with a header and quoted names', () => {
        const csv = productsToCsv([{ ...products[0], name: 'Вода "Моршинська"' }]);
        expect(csv.split('\n')).toEqual(['SKU,Barcode,Name,Unit,Stock', 'DRK-001,4820000000017,"Вода ""Моршинська""",шт,128']);
    });
});
