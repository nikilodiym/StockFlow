import { buildSyncPayload, validateTransfer } from '../src/features/inventory/services/DocumentService';

const args = {
    id: 'doc',
    status: 'posted',
    warehouse: 1,
    destination: 2,
    note: '',
    createdAt: '',
    items: [],
    deviceId: 'android',
};

it('sends the destination only for a transfer', () => {
    expect(buildSyncPayload({ ...args, type: 'transfer' }).changes[0].document.destination).toBe(2);
    for (const type of ['receipt', 'writeoff', 'inventory'] as const) {
        expect(buildSyncPayload({ ...args, type }).changes[0].document).not.toHaveProperty('destination');
        expect(() => validateTransfer(type, 1)).not.toThrow();
    }
});

it('requires a different warehouse only when posting a transfer', () => {
    expect(() => validateTransfer('transfer', 1)).toThrow('склад-одержувач');
    expect(() => validateTransfer('transfer', 1, 1)).toThrow('відрізнятися');
    expect(() => validateTransfer('transfer', 1, 2)).not.toThrow();
});
