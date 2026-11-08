import type { Product } from '../../products/types/product.types';

export type DocumentType = 'receipt' | 'writeoff' | 'inventory' | 'transfer';

/** Local statuses: 'conflict' is set when the server rejected the version. */
export type DocumentStatus = 'draft' | 'posted' | 'conflict' | string;

/** A product line of a document (product fields + quantity). */
export type DocumentItem = Product & {
    quantity: number;
    line_id?: number;
};

/** A saved document in the list. */
export type SavedDocument = {
    id: string;
    type: DocumentType;
    status: DocumentStatus;
    created_at: string;
    /** 1 when it is no longer waiting in the outbox. */
    is_synced?: number;
};

export type OutboxRow = {
    id: string;
    payload: string;
    created_at: string;
};

/** Body of the legacy POST /api/sync/ request kept in the outbox. */
export type LegacySyncPayload = {
    device_id: string;
    changes: {
        client_id: string;
        document: {
            id: string;
            type: DocumentType;
            status: string;
            warehouse: number;
            note: string;
            created_at: string;
            lines: { product: number; quantity: number; unit: string }[];
        };
    }[];
};

export type StatusFilter = 'Усі стани' | 'Чернетка' | 'Проведено' | 'Синхронізовано';
export type DateFilter = 'Усі дати' | 'Сьогодні' | '7 днів';
