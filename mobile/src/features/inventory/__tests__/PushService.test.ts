import type { SQLiteDatabase } from 'expo-sqlite';
import { PushService } from '../../../services/sync/PushService';
import { apiRequest } from '../../../services/api/client';
import { DocumentRepository } from '../repositories/DocumentRepository';
import { ProductRepository } from '../../products/repositories/ProductRepository';
import { PermissionError } from '../../auth/services/PermissionService';
jest.mock('../../../services/api/client', () => ({
    apiRequest: jest.fn(),
    readJson: async (r: { json: () => Promise<unknown> }) => r.json(),
}));
jest.mock('../repositories/DocumentRepository', () => ({
    DocumentRepository: { listOutbox: jest.fn(), deleteOutbox: jest.fn(), setStatus: jest.fn() },
}));
jest.mock('../../products/repositories/ProductRepository', () => ({ ProductRepository: { serverIdMap: jest.fn() } }));
const db = {} as SQLiteDatabase;
beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(DocumentRepository.listOutbox).mockResolvedValue([
        {
            id: 'draft',
            created_at: '',
            payload: JSON.stringify({ changes: [{ document: { lines: [{ product: 1, quantity: 2, unit: 'шт' }] } }] }),
        },
    ]);
    jest.mocked(ProductRepository.serverIdMap).mockResolvedValue(new Map([[1, 12]]));
});
it('keeps a document queued when an HTTP 200 contains a rejected result', async () => {
    jest.mocked(apiRequest).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
            results: [
                {
                    client_id: 'draft',
                    status: 'rejected',
                    reason: 'Немає доступу до цього складу',
                    code: 'permission_denied',
                },
            ],
        }),
    } as Response);
    await expect(PushService.push(db, 'http://server/api', 'token')).rejects.toBeInstanceOf(PermissionError);
    expect(DocumentRepository.deleteOutbox).not.toHaveBeenCalled();
});
it('removes an entry only after its own client id is accepted', async () => {
    jest.mocked(apiRequest).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ results: [{ client_id: 'draft', status: 'accepted' }] }),
    } as Response);
    await expect(PushService.push(db, 'http://server/api', 'token')).resolves.toEqual({ status: 'ok', synced: 1 });
    expect(DocumentRepository.deleteOutbox).toHaveBeenCalledWith(db, 'draft');
});
it('never sends an unresolved local product id as a server product id', async () => {
    jest.mocked(ProductRepository.serverIdMap).mockResolvedValue(new Map());
    await expect(PushService.push(db, 'http://server/api', 'token')).rejects.toThrow('зіставлений');
    expect(apiRequest).not.toHaveBeenCalled();
    expect(DocumentRepository.deleteOutbox).not.toHaveBeenCalled();
});
