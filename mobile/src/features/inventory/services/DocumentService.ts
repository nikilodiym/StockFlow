/** Document business rules and labels. Pure functions, covered by tests. */
import type { IconName } from '../../../components/ui/Icon';
import { WAREHOUSES } from '../../../constants/config';
import type {
    DateFilter,
    DocumentItem,
    DocumentType,
    LegacySyncPayload,
    SavedDocument,
    StatusFilter,
} from '../types/document.types';

export const DOCUMENT_TABS: [DocumentType, string][] = [
    ['receipt', 'Прихід'],
    ['writeoff', 'Списання'],
    ['inventory', 'Інвентаризація'],
    ['transfer', 'Переміщення'],
];

export const TYPE_LABEL: Record<DocumentType, string> = Object.fromEntries(DOCUMENT_TABS) as Record<
    DocumentType,
    string
>;

export const STATUS_FILTERS: StatusFilter[] = ['Усі стани', 'Чернетка', 'Проведено', 'Синхронізовано'];
export const DATE_FILTERS: DateFilter[] = ['Усі дати', 'Сьогодні', '7 днів'];

export const documentIcon = (type: DocumentType): IconName =>
    type === 'receipt'
        ? 'download'
        : type === 'writeoff'
          ? 'trash'
          : type === 'transfer'
            ? 'refresh'
            : 'file';

/** Short status text for the documents list. */
export function statusLabel(doc: SavedDocument): string {
    if (doc.status === 'conflict') return 'Конфлікт';
    if (doc.status === 'draft') return 'Чернетка';
    if (doc.status === 'posted') return 'Проведено';
    return doc.is_synced ? 'Синхронізовано' : doc.status;
}

export const shortId = (id: string): string => id.slice(0, 7).toUpperCase();

export function documentLabel(doc: Pick<SavedDocument, 'id' | 'type'>): string {
    const prefix: Record<DocumentType, string> = {
        receipt: 'ПР',
        writeoff: 'СП',
        inventory: 'ІНВ',
        transfer: 'ПМ',
    };
    return `${prefix[doc.type]}-${doc.id.slice(0, 4).toUpperCase()}`;
}

export const totalQuantity = (items: DocumentItem[]): number =>
    items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

export const warehouseId = (name: string): number =>
    WAREHOUSES.find((w) => w.name === name)?.id ?? WAREHOUSES[0].id;

const DAY_MS = 86400000;

export function filterDocuments(
    docs: SavedDocument[],
    type: DocumentType,
    status: StatusFilter,
    date: DateFilter,
    now: Date = new Date(),
): SavedDocument[] {
    return docs.filter((doc) => {
        if (doc.type !== type) return false;
        if (status === 'Чернетка' && doc.status !== 'draft') return false;
        if (status === 'Проведено' && doc.status !== 'posted') return false;
        if (status === 'Синхронізовано' && !doc.is_synced) return false;
        if (date === 'Сьогодні' && new Date(doc.created_at).toDateString() !== now.toDateString())
            return false;
        if (date === '7 днів' && now.getTime() - new Date(doc.created_at).getTime() > 7 * DAY_MS)
            return false;
        return true;
    });
}

/** Payload of the legacy /api/sync/ endpoint for one document. */
export function buildSyncPayload(args: {
    id: string;
    type: DocumentType;
    status: string;
    warehouse: number;
    destination?: number | null;
    note: string;
    createdAt: string;
    items: DocumentItem[];
    deviceId: string;
}): LegacySyncPayload {
    return {
        device_id: args.deviceId,
        changes: [
            {
                client_id: args.id,
                document: {
                    id: args.id,
                    type: args.type,
                    status: args.status,
                    warehouse: args.warehouse,
                    ...(args.type === 'transfer' ? { destination: args.destination ?? null } : {}),
                    note: args.note,
                    created_at: args.createdAt,
                    lines: args.items.map((item) => ({
                        product: item.id,
                        quantity: item.quantity,
                        unit: item.unit || 'шт',
                    })),
                },
            },
        ],
    };
}

export function validateTransfer(type: DocumentType, warehouse: number, destination?: number | null): void {
    if (type !== 'transfer') return;
    if (!destination) throw new Error('Для переміщення оберіть склад-одержувач у документі.');
    if (destination === warehouse)
        throw new Error('Склад-одержувач має відрізнятися від складу-відправника.');
}

/** Same payload with status = posted (when a saved draft is posted later). */
export function markPayloadPosted(payload: string): string {
    try {
        const data = JSON.parse(payload) as Partial<LegacySyncPayload>;
        const document = data.changes?.[0]?.document;
        if (document) document.status = 'posted';
        return JSON.stringify(data);
    } catch {
        return payload; // the server reports malformed queued data during sync
    }
}
