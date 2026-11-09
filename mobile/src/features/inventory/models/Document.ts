/** Mapping for the `documents` table (and the outbox flag joined to it). */
import { TABLES } from '../../../database/schema';
import type { DocumentType, SavedDocument } from '../types/document.types';

type DocumentRow = {
    id: string;
    type: string;
    status: string | null;
    created_at: string;
    is_synced?: number | null;
    warehouse?: number;
    destination?: number | null;
    created_by?: number | null;
    note?: string;
    line_count?: number;
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
            warehouse: row.warehouse,
            destination: row.destination,
            created_by: row.created_by,
            note: row.note,
            line_count: row.line_count,
        };
    },
};
