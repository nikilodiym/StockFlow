import { mapPayloadProducts } from '../src/services/sync/PushService';

const payload = JSON.stringify({
    device_id: 'android',
    changes: [{ client_id: 'd1', document: { id: 'd1', type: 'receipt', status: 'draft', warehouse: 1, note: '', created_at: '', lines: [{ product: 5, quantity: 1, unit: 'шт' }, { product: 7, quantity: 2, unit: 'шт' }] } }],
});

describe('mapPayloadProducts', () => {
    it('replaces local product ids with server ids when known', () => {
        const mapped = JSON.parse(mapPayloadProducts(payload, new Map([[5, 6]])));
        expect(mapped.changes[0].document.lines.map((l: { product: number }) => l.product)).toEqual([6, 7]);
    });

    it('keeps the payload as is without a mapping or for broken JSON', () => {
        expect(mapPayloadProducts(payload, new Map())).toBe(payload);
        expect(mapPayloadProducts('{oops', new Map([[1, 2]]))).toBe('{oops');
    });
});
