import type { SQLiteDatabase } from 'expo-sqlite';
import { DocumentRepository } from '../repositories/DocumentRepository';
import { buildSyncPayload } from './DocumentService';
import { ACTIVE_DOCUMENT_ID } from '../../../constants/config';
import type { Product } from '../../products/types/product.types';
import type { DocumentItem } from '../types/document.types';

/** Read and merge inside a transaction, so rapid scans never use stale UI state. */
export async function addProductToDocument(
    db: SQLiteDatabase,
    id: string,
    product: Product,
    amount: number,
    deviceId: string,
): Promise<DocumentItem[]> {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Введіть коректну кількість товару.');
    await db.withTransactionAsync(async () => {
        if (id !== ACTIVE_DOCUMENT_ID) {
            const doc = await DocumentRepository.get(db, id);
            if (!doc || doc.status !== 'draft') throw new Error('Додавати товари можна лише до чернетки.');
        }
        const line = await db.getFirstAsync<{ id: number; quantity: number }>(
            'SELECT id,quantity FROM lines WHERE document_id=? AND product_id=? AND unit=? LIMIT 1',
            [id, product.id, product.unit],
        );
        if (line) await DocumentRepository.setLineQuantity(db, line.id, Number(line.quantity) + amount);
        else await DocumentRepository.insertLine(db, product.id, amount, product.unit || 'шт', id);
        if (id !== ACTIVE_DOCUMENT_ID) await queueSavedDocument(db, id, deviceId);
    });
    return DocumentRepository.getLines(db, id);
}

/** Rebuild the queued payload from the actual saved lines after every edit. */
export async function queueSavedDocument(db: SQLiteDatabase, id: string, deviceId: string): Promise<void> {
    const doc = await DocumentRepository.get(db, id);
    if (!doc) throw new Error('Документ не знайдено.');
    const items = await DocumentRepository.getLines(db, id);
    if (items.length === 0) {
        await DocumentRepository.deleteOutbox(db, id);
        return;
    }
    const payload = buildSyncPayload({
        id: doc.id,
        type: doc.type,
        status: doc.status,
        warehouse: doc.warehouse ?? 1,
        destination: doc.destination,
        note: doc.note ?? '',
        createdAt: doc.created_at,
        items,
        deviceId,
    });
    await DocumentRepository.queue(db, id, JSON.stringify(payload));
}
