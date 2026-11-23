jest.mock('../src/services/sync/PullService', () => ({ PullService: { pull: jest.fn() } }));
jest.mock('../src/services/sync/PushService', () => ({ PushService: { push: jest.fn() } }));

import { SyncService } from '../src/services/sync/SyncService';
import { PullService } from '../src/services/sync/PullService';
import { PushService } from '../src/services/sync/PushService';
import type { SQLiteDatabase } from 'expo-sqlite';

test('initial catalog download triggers a UI reload even when the second pull has no changes', async () => {
    jest.mocked(PullService.pull).mockResolvedValueOnce(9).mockResolvedValueOnce(0);
    jest.mocked(PushService.push).mockResolvedValue({ status: 'ok', synced: 0, issues: [] } as Awaited<ReturnType<typeof PushService.push>>);
    const result = await SyncService.run({} as SQLiteDatabase, 'https://stockflow.test/api', 'test-only');
    expect(result.pulled).toBe(9);
});
