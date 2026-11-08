/** Server → phone: catalog and stock changed since the last pull (GET /api/sync/pull/). */
import type { SQLiteDatabase } from 'expo-sqlite';
import { STORAGE_KEYS, TIMEOUTS } from '../../constants/config';
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

export const PullService = {
    /** Returns how many products were added or updated. */
    async pull(db: SQLiteDatabase, serverUrl: string, token: string): Promise<number> {
        const cursor = await Storage.get(cursorKey(serverUrl));
        const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
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
