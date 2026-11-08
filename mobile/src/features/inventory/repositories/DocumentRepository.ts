/** Access to documents, lines and the outbox in the local SQLite database. */
import type { SQLiteDatabase } from 'expo-sqlite';
import { ACTIVE_DOCUMENT_ID } from '../../../constants/config';
import { DocumentModel } from '../models/Document';
import { DocumentLineModel } from '../models/DocumentLine';
import type { DocumentItem, DocumentType, OutboxRow, SavedDocument } from '../types/document.types';

export const DocumentRepository = {
    // --- lines -------------------------------------------------------------
    async getLines(db: SQLiteDatabase, documentId: string = ACTIVE_DOCUMENT_ID): Promise<DocumentItem[]> {
        const rows = await db.getAllAsync<Parameters<typeof DocumentLineModel.fromRow>[0]>(
            DocumentLineModel.selectSql,
            [documentId],
        );
        return rows.map(DocumentLineModel.fromRow);
    },

    /** Returns the new line id. */
    async insertLine(
        db: SQLiteDatabase,
        productId: number,
        quantity: number,
        unit: string,
        documentId: string = ACTIVE_DOCUMENT_ID,
    ): Promise<number> {
        const result = await db.runAsync(
            'INSERT INTO lines (document_id, product_id, quantity, unit) VALUES (?, ?, ?, ?)',
            [documentId, productId, quantity, unit],
        );
        return Number(result.lastInsertRowId);
    },

    setLineQuantity: (db: SQLiteDatabase, lineId: number, quantity: number) =>
        db.runAsync('UPDATE lines SET quantity = ? WHERE id = ?', [quantity, lineId]),

    deleteLine: (db: SQLiteDatabase, lineId: number) => db.runAsync('DELETE FROM lines WHERE id = ?', [lineId]),

    clearActive: (db: SQLiteDatabase) => db.runAsync('DELETE FROM lines WHERE document_id = ?', [ACTIVE_DOCUMENT_ID]),

    // --- documents ---------------------------------------------------------
    async list(db: SQLiteDatabase): Promise<SavedDocument[]> {
        const rows = await db.getAllAsync<Parameters<typeof DocumentModel.fromRow>[0]>(
            `SELECT documents.id, documents.type, documents.status, documents.created_at, documents.warehouse, documents.created_by, documents.note,
                    (SELECT COUNT(*) FROM lines WHERE lines.document_id = documents.id) AS line_count,
                    CASE WHEN outbox.id IS NULL THEN 1 ELSE 0 END AS is_synced
             FROM documents LEFT JOIN outbox ON outbox.id = documents.id
             ORDER BY documents.created_at DESC`,
        );
        return rows.map(DocumentModel.fromRow);
    },

    /** Saves the current (active) document: new row, its lines move to it, payload goes to the outbox. */
    async saveActive(
        db: SQLiteDatabase,
        doc: {
            id: string;
            type: DocumentType;
            status: string;
            warehouse: number;
            note: string;
            createdAt: string;
            payload: string;
            createdBy?: number;
        },
    ): Promise<void> {
        await db.withTransactionAsync(async () => {
            await db.runAsync(
                'INSERT INTO documents (id, type, status, warehouse, note, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [doc.id, doc.type, doc.status, doc.warehouse, doc.note, doc.createdAt, doc.createdBy ?? null],
            );
            await db.runAsync('UPDATE lines SET document_id = ? WHERE document_id = ?', [doc.id, ACTIVE_DOCUMENT_ID]);
            await db.runAsync('INSERT INTO outbox (id, payload, created_at) VALUES (?, ?, ?)', [
                doc.id,
                doc.payload,
                doc.createdAt,
            ]);
        });
    },

    get: (db: SQLiteDatabase, id: string) =>
        db.getFirstAsync<SavedDocument>('SELECT * FROM documents WHERE id = ?', [id]),

    async createDraft(
        db: SQLiteDatabase,
        doc: { id: string; type: DocumentType; warehouse: number; createdAt: string; createdBy?: number },
    ): Promise<void> {
        await db.runAsync(
            "INSERT INTO documents (id,type,status,warehouse,note,created_at,created_by) VALUES (?,?,'draft',?,'',?,?)",
            [doc.id, doc.type, doc.warehouse, doc.createdAt, doc.createdBy ?? null],
        );
    },

    async queue(db: SQLiteDatabase, id: string, payload: string): Promise<void> {
        await db.runAsync(
            'INSERT INTO outbox (id,payload,created_at) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload',
            [id, payload, new Date().toISOString()],
        );
    },

    setStatus: (db: SQLiteDatabase, id: string, status: string) =>
        db.runAsync('UPDATE documents SET status = ? WHERE id = ?', [status, id]),

    async delete(db: SQLiteDatabase, id: string): Promise<void> {
        await db.withTransactionAsync(async () => {
            await db.runAsync('DELETE FROM lines WHERE document_id = ?', [id]);
            await db.runAsync('DELETE FROM documents WHERE id = ?', [id]);
            await db.runAsync('DELETE FROM outbox WHERE id = ?', [id]);
        });
    },

    // --- outbox ------------------------------------------------------------
    listOutbox: (db: SQLiteDatabase) => db.getAllAsync<OutboxRow>('SELECT * FROM outbox ORDER BY created_at'),

    getOutbox: (db: SQLiteDatabase, id: string) =>
        db.getFirstAsync<OutboxRow>('SELECT * FROM outbox WHERE id = ?', [id]),

    updateOutbox: (db: SQLiteDatabase, id: string, payload: string) =>
        db.runAsync('UPDATE outbox SET payload = ? WHERE id = ?', [payload, id]),

    deleteOutbox: (db: SQLiteDatabase, id: string) => db.runAsync('DELETE FROM outbox WHERE id = ?', [id]),

    async outboxCount(db: SQLiteDatabase): Promise<number> {
        const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox');
        return row?.n ?? 0;
    },
};
