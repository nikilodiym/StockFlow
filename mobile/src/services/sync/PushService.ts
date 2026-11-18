/** Phone → server: sends queued documents from the outbox (legacy POST /api/sync/). */
import type { SQLiteDatabase } from 'expo-sqlite';
import { TIMEOUTS } from '../../constants/config';
import { DocumentRepository } from '../../features/inventory/repositories/DocumentRepository';
import type { LegacySyncPayload } from '../../features/inventory/types/document.types';
import { ProductRepository } from '../../features/products/repositories/ProductRepository';
import { apiRequest, readJson } from '../api/client';
import { PermissionError } from '../../features/auth/services/PermissionService';
import { ENDPOINTS } from '../api/endpoints';
import { documentLabel, TYPE_LABEL } from '../../features/inventory/services/DocumentService';

export type PushIssue = { documentId: string; label: string; message: string; conflict?: boolean };

export type PushResult =
    | { status: 'ok'; synced: number }
    | { status: 'unauthorized'; synced: number }
    | { status: 'partial'; synced: number; issues: PushIssue[] };

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
        const issues: PushIssue[] = [];
        for (const entry of pending) {
            let label = entry.id;
            try {
                const data = JSON.parse(entry.payload) as LegacySyncPayload;
                const document = data.changes?.[0]?.document;
                if (document?.id && TYPE_LABEL[document.type])
                    label = `${TYPE_LABEL[document.type]} ${documentLabel(document)}`;
                for (const change of data.changes ?? []) {
                    for (const line of change.document?.lines ?? []) {
                        if (!serverIds.has(line.product))
                            throw new Error(
                                'Один із товарів ще не зіставлений із серверним каталогом. Оновіть каталог або створіть товар на сервері. Документ збережено на пристрої.',
                            );
                    }
                }
                const response = await apiRequest(serverUrl, ENDPOINTS.legacySync, {
                    method: 'POST',
                    rawBody: mapPayloadProducts(entry.payload, serverIds),
                    token,
                    timeout: TIMEOUTS.sync,
                });
                if (response.status === 401) return { status: 'unauthorized', synced };
                if (response.status === 403) throw new PermissionError();
                if (response.status === 409) {
                    await DocumentRepository.setStatus(db, entry.id, 'conflict');
                    issues.push({
                        documentId: entry.id,
                        label,
                        message: 'Конфлікт версій. Відкрийте документ для розв’язання.',
                        conflict: true,
                    });
                    continue;
                }
                if (!response.ok) {
                    const message = await response.text().catch(() => '');
                    throw new Error(`Сервер повернув ${response.status}. ${message}`);
                }
                const body = await readJson<{
                    results?: { client_id: string; status: string; reason?: string; code?: string }[];
                }>(response);
                const result = body.results?.find((r) => r.client_id === entry.id);
                if (!result || result.status !== 'accepted') {
                    if (result?.code === 'permission_denied') throw new PermissionError(result.reason);
                    throw new Error(
                        result?.reason ||
                            'Сервер не підтвердив збереження документа. Локальні дані залишено в черзі.',
                    );
                }
                await DocumentRepository.deleteOutbox(db, entry.id);
                synced++;
            } catch (error) {
                // Keep this document queued, and still deliver the remaining documents.
                issues.push({
                    documentId: entry.id,
                    label,
                    message: error instanceof Error ? error.message : String(error),
                });
            }
        }
        return issues.length ? { status: 'partial', synced, issues } : { status: 'ok', synced };
    },
};
