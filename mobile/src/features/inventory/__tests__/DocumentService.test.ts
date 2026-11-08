import { buildSyncPayload, filterDocuments, markPayloadPosted, statusLabel, totalQuantity, warehouseId } from '../services/DocumentService';
import type { DocumentItem, SavedDocument } from '../types/document.types';

const now = new Date('2026-11-08T12:00:00Z');
const docs: SavedDocument[] = [
    { id: 'a', type: 'receipt', status: 'draft', created_at: '2026-11-08T09:00:00Z', is_synced: 0 },
    { id: 'b', type: 'receipt', status: 'posted', created_at: '2026-11-05T09:00:00Z', is_synced: 1 },
    { id: 'c', type: 'receipt', status: 'posted', created_at: '2026-10-01T09:00:00Z', is_synced: 1 },
    { id: 'd', type: 'writeoff', status: 'draft', created_at: '2026-11-08T09:00:00Z', is_synced: 0 },
];
const ids = (list: SavedDocument[]) => list.map(d => d.id);

describe('filterDocuments', () => {
    it('keeps only the selected type', () => expect(ids(filterDocuments(docs, 'receipt', 'Усі стани', 'Усі дати', now))).toEqual(['a', 'b', 'c']));
    it('filters by status', () => {
        expect(ids(filterDocuments(docs, 'receipt', 'Чернетка', 'Усі дати', now))).toEqual(['a']);
        expect(ids(filterDocuments(docs, 'receipt', 'Проведено', 'Усі дати', now))).toEqual(['b', 'c']);
        expect(ids(filterDocuments(docs, 'receipt', 'Синхронізовано', 'Усі дати', now))).toEqual(['b', 'c']);
    });
    it('filters by date', () => {
        expect(ids(filterDocuments(docs, 'receipt', 'Усі стани', 'Сьогодні', now))).toEqual(['a']);
        expect(ids(filterDocuments(docs, 'receipt', 'Усі стани', '7 днів', now))).toEqual(['a', 'b']);
    });
});

describe('statusLabel', () => {
    it.each([
        ['conflict', 0, 'Конфлікт'],
        ['draft', 0, 'Чернетка'],
        ['posted', 1, 'Проведено'],
        ['synced', 1, 'Синхронізовано'],
    ])('%s → %s', (status, isSynced, label) => {
        expect(statusLabel({ id: 'x', type: 'receipt', status, created_at: '', is_synced: isSynced as number })).toBe(label);
    });
});

const items: DocumentItem[] = [
    { id: 1, sku: 'A', barcode: '1', name: 'A', unit: 'шт', stock: 0, quantity: 2, line_id: 10 },
    { id: 2, sku: 'B', barcode: '2', name: 'B', unit: '', stock: 0, quantity: 3.5, line_id: 11 },
];

it('totalQuantity sums lines', () => expect(totalQuantity(items)).toBe(5.5));

it('warehouseId maps names, defaults to the first warehouse', () => {
    expect(warehouseId('Склад №2 Львів')).toBe(2);
    expect(warehouseId('невідомий')).toBe(1);
});

describe('sync payload', () => {
    const payload = buildSyncPayload({ id: 'doc-1', type: 'receipt', status: 'draft', warehouse: 1, note: '', createdAt: '2026-11-08T09:00:00Z', items, deviceId: 'android' });

    it('uses the legacy /api/sync/ format', () => {
        expect(payload.device_id).toBe('android');
        expect(payload.changes[0].client_id).toBe('doc-1');
        expect(payload.changes[0].document.lines).toEqual([
            { product: 1, quantity: 2, unit: 'шт' },
            { product: 2, quantity: 3.5, unit: 'шт' },
        ]);
    });

    it('markPayloadPosted switches status and keeps the rest', () => {
        const posted = JSON.parse(markPayloadPosted(JSON.stringify(payload)));
        expect(posted.changes[0].document.status).toBe('posted');
        expect(posted.changes[0].document.lines).toHaveLength(2);
    });

    it('markPayloadPosted leaves broken JSON untouched', () => expect(markPayloadPosted('{oops')).toBe('{oops'));
});
