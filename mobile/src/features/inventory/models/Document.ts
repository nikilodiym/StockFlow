/** Mapping for the `documents` table (and the outbox flag joined to it). */
import { TABLES } from '../../../database/schema';
import type { DocumentType, SavedDocument } from '../types/document.types';

type DocumentRow = {
    id: string;
    type: string;
    status: string | null;
    created_at: string;
    is_synced?: number | null;
};

export const DocumentModel = {
    table: TABLES.documents,

    fromRow(row: DocumentRow): SavedDocument {
        return {
            id: row.id,
            type: row.type as DocumentType,
            status: row.status ?? 'draft',
            created_at: row.created_at,
            is_synced: row.is_synced ?? 0,
        };
    },
};
