/**
 * One sync round: first push local documents, then pull the catalog.
 * Push goes first so a pull can never overwrite changes not yet sent.
 */
import type { SQLiteDatabase } from 'expo-sqlite';
import { getErrorMessage } from '../../utils/formatters';
import { PullService } from './PullService';
import { PushService, type PushResult } from './PushService';

export type SyncResult = {
    push: PushResult;
    /** Products updated by the pull; null when the pull did not run or failed. */
    pulled: number | null;
    pullError?: string;
};

export const SyncService = {
    async run(db: SQLiteDatabase, serverUrl: string, token: string): Promise<SyncResult> {
        const push = await PushService.push(db, serverUrl, token);
        if (push.status !== 'ok') return { push, pulled: null };
        try {
            return { push, pulled: await PullService.pull(db, serverUrl, token) };
        } catch (error) {
            // The catalog pull is best-effort: documents were already delivered.
            return { push, pulled: null, pullError: getErrorMessage(error) };
        }
    },
};
