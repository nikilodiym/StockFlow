import { PushService } from '../src/services/sync/PushService';
import { DocumentRepository } from '../src/features/inventory/repositories/DocumentRepository';
import { ProductRepository } from '../src/features/products/repositories/ProductRepository';
import { apiRequest } from '../src/services/api/client';

jest.mock('../src/features/inventory/repositories/DocumentRepository');
jest.mock('../src/features/products/repositories/ProductRepository');
jest.mock('../src/services/api/client', () => ({
    apiRequest: jest.fn(),
    readJson: (r: Response) => r.json(),
}));

const entry = (id: string, type: string) => ({
    id,
    created_at: '',
    payload: JSON.stringify({
        device_id: 'android',
        changes: [
            {
                client_id: id,
                document: { id, type, warehouse: 1, status: 'posted', lines: [{ product: 1, quantity: 2 }] },
            },
        ],
    }),
});
const response = (status: number, results: object[]) => ({
    status,
    ok: status < 400,
    json: async () => ({ results }),
    text: async () => '',
});

beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(ProductRepository.serverIdMap).mockResolvedValue(new Map([[1, 42]]));
});

it('keeps a failed transfer queued and sends the receipt after it', async () => {
    jest.mocked(DocumentRepository.listOutbox).mockResolvedValue([
        entry('t1', 'transfer'),
        entry('r1', 'receipt'),
    ]);
    jest.mocked(apiRequest)
        .mockResolvedValueOnce(
            response(200, [
                { client_id: 't1', status: 'rejected', reason: 'Вкажіть склад-одержувач' },
            ]) as Response,
        )
        .mockResolvedValueOnce(response(200, [{ client_id: 'r1', status: 'accepted' }]) as Response);
    const result = await PushService.push({} as never, 'server', 'token');
    expect(result).toMatchObject({
        status: 'partial',
        synced: 1,
        issues: [{ documentId: 't1', label: 'Переміщення ПМ-T1' }],
    });
    expect(DocumentRepository.deleteOutbox).toHaveBeenCalledTimes(1);
    expect(DocumentRepository.deleteOutbox).toHaveBeenCalledWith({}, 'r1');
    const sent = JSON.parse(jest.mocked(apiRequest).mock.calls[1][2]!.rawBody!);
    expect(sent.changes[0].document.type).toBe('receipt');
});

it('continues after a conflict and leaves the conflicting document intact', async () => {
    jest.mocked(DocumentRepository.listOutbox).mockResolvedValue([
        entry('t1', 'transfer'),
        entry('r1', 'receipt'),
    ]);
    jest.mocked(apiRequest)
        .mockResolvedValueOnce(response(409, []) as Response)
        .mockResolvedValueOnce(response(200, [{ client_id: 'r1', status: 'accepted' }]) as Response);
    expect(await PushService.push({} as never, 'server', 'token')).toMatchObject({
        status: 'partial',
        synced: 1,
    });
    expect(DocumentRepository.setStatus).toHaveBeenCalledWith({}, 't1', 'conflict');
    expect(DocumentRepository.deleteOutbox).toHaveBeenCalledWith({}, 'r1');
});

it('stops for an expired token so the caller can refresh it', async () => {
    jest.mocked(DocumentRepository.listOutbox).mockResolvedValue([
        entry('r1', 'receipt'),
        entry('r2', 'receipt'),
    ]);
    jest.mocked(apiRequest).mockResolvedValueOnce(response(401, []) as Response);
    expect(await PushService.push({} as never, 'server', 'token')).toEqual({
        status: 'unauthorized',
        synced: 0,
    });
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(DocumentRepository.deleteOutbox).not.toHaveBeenCalled();
});
