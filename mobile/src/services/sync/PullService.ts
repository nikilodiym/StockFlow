/** Server → phone: catalog and stock changed since the last pull (GET /api/sync/pull/). */
import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import { STORAGE_KEYS, TIMEOUTS } from '../../constants/config';
import { DocumentRepository } from '../../features/inventory/repositories/DocumentRepository';
import { ProductRepository } from '../../features/products/repositories/ProductRepository';
import type { ServerProduct } from '../../features/products/types/product.types';
import { apiRequest, readJson } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { Storage } from '../storage/Storage';

type PullResponse = {
    cursor: string;
    products?: ServerProduct[];
    detail?: string;
};

/** The cursor is remembered per server, so switching servers starts a full pull. */
const cursorKey = (serverUrl: string) => `${STORAGE_KEYS.pullCursor}:${serverUrl}`;

/**
 * Query of a pull. Besides the cursor the phone reports itself: the same device id as the
 * outbox payloads (Platform.OS) and how many documents still wait to be sent, so the admin
 * panel can show "у черзі" per worker.
 */
export function pullQuery(cursor: string | null, pending: number, platform: string = Platform.OS): string {
    const params = new URLSearchParams({ device_id: platform, platform, pending: String(pending) });
    if (cursor) params.set('cursor', cursor);
    return `?${params.toString()}`;
}

export const PullService = {
    /** Returns how many products were added or updated. */
    async pull(db: SQLiteDatabase, serverUrl: string, token: string): Promise<number> {
        const cursor = await Storage.get(cursorKey(serverUrl));
        const query = pullQuery(cursor, await DocumentRepository.countOutbox(db));
        const response = await apiRequest(serverUrl, `${ENDPOINTS.pull}${query}`, { token, timeout: TIMEOUTS.sync });
        const data = await readJson<PullResponse>(response);
        if (!response.ok) throw new Error(data.detail || `Сервер повернув ${response.status}.`);

        const products = (data.products ?? []).filter(product => product.is_active !== false);
        await db.withTransactionAsync(async () => {
            for (const product of products) await ProductRepository.upsertFromServer(db, product);
        });
        if (data.cursor) await Storage.set(cursorKey(serverUrl), data.cursor);
        return products.length;
    },
};
