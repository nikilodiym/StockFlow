/** Phone → server: sends queued documents from the outbox (legacy POST /api/sync/). */
import type { SQLiteDatabase } from 'expo-sqlite';
import { TIMEOUTS } from '../../constants/config';
import { DocumentRepository } from '../../features/inventory/repositories/DocumentRepository';
import type { LegacySyncPayload } from '../../features/inventory/types/document.types';
import { ProductRepository } from '../../features/products/repositories/ProductRepository';
import { apiRequest } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

export type PushResult =
    | { status: 'ok'; synced: number }
    | { status: 'unauthorized'; synced: number }
    | { status: 'conflict'; synced: number; documentId: string };

/**
 * Local product ids → server product ids. Documents are created offline with
 * local ids; once the catalog was pulled the server ids are known.
 */
export function mapPayloadProducts(payload: string, serverIds: Map<number, number>): string {
    if (serverIds.size === 0) return payload;
    try {
        const data = JSON.parse(payload) as LegacySyncPayload;
        for (const change of data.changes ?? []) {
            for (const line of change.document?.lines ?? []) {
                line.product = serverIds.get(line.product) ?? line.product;
            }
        }
        return JSON.stringify(data);
    } catch {
        return payload;
    }
}

export const PushService = {
    async push(db: SQLiteDatabase, serverUrl: string, token: string): Promise<PushResult> {
        const pending = await DocumentRepository.listOutbox(db);
        const serverIds = await ProductRepository.serverIdMap(db);
        let synced = 0;
        for (const entry of pending) {
            const response = await apiRequest(serverUrl, ENDPOINTS.legacySync, {
                method: 'POST',
                rawBody: mapPayloadProducts(entry.payload, serverIds),
                token,
                timeout: TIMEOUTS.sync,
            });
            if (response.status === 401) return { status: 'unauthorized', synced };
            if (response.status === 409) {
                await DocumentRepository.setStatus(db, entry.id, 'conflict');
                return { status: 'conflict', synced, documentId: entry.id };
            }
            if (!response.ok) {
                const message = await response.text().catch(() => '');
                throw new Error(`Сервер повернув ${response.status}. ${message}`);
            }
            await DocumentRepository.deleteOutbox(db, entry.id);
            synced++;
        }
        return { status: 'ok', synced };
    },
};
