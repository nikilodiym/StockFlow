import { apiRequest } from '../../../services/api/client';
import { ProductRepository } from '../repositories/ProductRepository';
import { ProductCreationService, validateProductDraft } from '../services/ProductCreationService';
import { PermissionError } from '../../auth/services/PermissionService';
import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('../../../services/api/client', () => ({
    apiRequest: jest.fn(),
    readJson: async (r: { json: () => Promise<unknown> }) => r.json(),
}));
jest.mock('../repositories/ProductRepository', () => ({
    ProductRepository: { duplicate: jest.fn(), upsertFromServer: jest.fn(), getBySku: jest.fn() },
}));
const db = {} as SQLiteDatabase;
const draft = { sku: ' NEW-01 ', name: ' Новий товар ', barcode: '4820000000123', unit: 'шт' };
beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(ProductRepository.duplicate).mockResolvedValue(null);
});
it('validates and normalizes a new card before any API write', () => {
    expect(validateProductDraft(draft).sku).toBe('NEW-01');
    expect(() => validateProductDraft({ ...draft, name: '' })).toThrow('назву');
    expect(() => validateProductDraft({ ...draft, barcode: 'код з пробілами' })).toThrow('Штрихкод');
});
it('does not silently overwrite an existing SKU or barcode', async () => {
    jest.mocked(ProductRepository.duplicate).mockResolvedValue({
        id: 1,
        sku: 'NEW-01',
        barcode: draft.barcode,
        name: 'Наявний',
        unit: 'шт',
        stock: 0,
    });
    await expect(ProductCreationService.create(db, 'http://server/api', 'token', draft)).rejects.toThrow('уже є');
    expect(apiRequest).not.toHaveBeenCalled();
});
it('creates on the server, remembers its id locally and returns a selectable product', async () => {
    const remote = {
        id: 42,
        sku: 'NEW-01',
        name: 'Новий товар',
        barcode: draft.barcode,
        unit: 'шт',
        stock: 0,
        is_active: true,
    };
    const local = { ...remote, id: 7, server_id: 42 };
    jest.mocked(apiRequest).mockResolvedValue({ ok: true, status: 201, json: async () => remote } as Response);
    jest.mocked(ProductRepository.getBySku).mockResolvedValue(local);
    const result = await ProductCreationService.create(db, 'http://server/api', 'token', draft);
    expect(apiRequest).toHaveBeenCalledWith(
        'http://server/api',
        '/products/',
        expect.objectContaining({ method: 'POST', body: { ...draft, sku: 'NEW-01', name: 'Новий товар' } }),
    );
    expect(ProductRepository.upsertFromServer).toHaveBeenCalledWith(db, remote);
    expect(result.server_id).toBe(42);
});
it('does not add local catalog records when the server denies permission', async () => {
    jest.mocked(apiRequest).mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(ProductCreationService.create(db, 'http://server/api', 'token', draft)).rejects.toBeInstanceOf(
        PermissionError,
    );
    expect(ProductRepository.upsertFromServer).not.toHaveBeenCalled();
});
it('leaves the catalog unchanged when the request fails', async () => {
    jest.mocked(apiRequest).mockRejectedValue(new Error('offline'));
    await expect(ProductCreationService.create(db, 'http://server/api', 'token', draft)).rejects.toThrow('offline');
    expect(ProductRepository.upsertFromServer).not.toHaveBeenCalled();
});
