/** Shared current document and an explicit destination for new scans. */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { canPerform, PermissionError, type Permission } from '../../auth/services/PermissionService';
import { ACTIVE_DOCUMENT_ID } from '../../../constants/config';
import { uuid } from '../../../utils/formatters';
import type { Product } from '../../products/types/product.types';
import { DocumentRepository } from '../repositories/DocumentRepository';
import { buildSyncPayload, warehouseId } from '../services/DocumentService';
import { addProductToDocument, queueSavedDocument } from '../services/DraftService';
import type { DocumentItem, DocumentType, SavedDocument } from '../types/document.types';

type InventoryContextValue = {
    docType: DocumentType;
    setDocType: (type: DocumentType) => void;
    quantity: string;
    setQuantity: (value: string) => void;
    items: DocumentItem[];
    scanItems: DocumentItem[];
    scanDocumentId: string | null;
    selectScanDocument: (id: string | null) => Promise<void>;
    createDraft: (type: DocumentType) => Promise<string>;
    docNote: string;
    setDocNote: (value: string) => void;
    savedDocs: SavedDocument[];
    outboxCount: number;
    refreshDocs: () => Promise<void>;
    addItem: (product: Product, quantity: number) => Promise<void>;
    changeItemQuantity: (item: DocumentItem, delta: number) => Promise<void>;
    changeSavedItemQuantity: (
        documentId: string,
        docItems: DocumentItem[],
        item: DocumentItem,
        delta: number,
    ) => Promise<DocumentItem[]>;
    loadItems: (documentId: string) => Promise<DocumentItem[]>;
    saveCurrent: (status: 'draft' | 'posted', warehouse: string) => Promise<string>;
    postSaved: (id: string) => Promise<void>;
    deleteDocument: (id: string) => Promise<void>;
    clearCurrent: () => Promise<void>;
    resolveConflict: (id: string) => Promise<void>;
};
const InventoryContext = createContext<InventoryContextValue | null>(null);
export function InventoryProvider({ children }: { children: React.ReactNode }) {
    const db = useSQLiteContext();
    const { user } = useAuth();
    const { warehouse } = useSettings();
    const [docType, setDocType] = useState<DocumentType>('receipt');
    const [quantity, setQuantity] = useState('1');
    const [items, setItems] = useState<DocumentItem[]>([]);
    const [targetItems, setTargetItems] = useState<DocumentItem[]>([]);
    const [scanDocumentId, setScanDocumentId] = useState<string | null>(null);
    const [docNote, setDocNote] = useState('');
    const [savedDocs, setSavedDocs] = useState<SavedDocument[]>([]);
    const [outboxCount, setOutboxCount] = useState(0);
    const pending = useRef<Promise<unknown>>(Promise.resolve());
    const mutate = useCallback(<T,>(work: () => Promise<T>): Promise<T> => {
        const task = pending.current.then(work, work);
        pending.current = task.catch(() => undefined);
        return task;
    }, []);
    const requireAccess = useCallback(
        (action: Permission, doc?: SavedDocument) => {
            if (!canPerform(user, action, warehouseId(warehouse), doc)) throw new PermissionError();
        },
        [user, warehouse],
    );
    const refreshDocs = useCallback(async () => {
        const [docs, count] = await Promise.all([DocumentRepository.list(db), DocumentRepository.outboxCount(db)]);
        setSavedDocs(docs);
        setOutboxCount(count);
    }, [db]);
    useEffect(() => {
        let active = true;
        void Promise.all([DocumentRepository.getLines(db), refreshDocs()])
            .then(([rows]) => {
                if (active) setItems(rows);
            })
            .catch((error) => {
                if (active) console.error('Помилка бази даних:', error);
            });
        return () => {
            active = false;
        };
    }, [db, refreshDocs]);
    const selectScanDocument = useCallback(
        async (id: string | null) => {
            if (id) {
                const doc = await DocumentRepository.get(db, id);
                if (!doc) throw new Error('Документ не знайдено.');
                requireAccess('document.edit', doc);
                setTargetItems(await DocumentRepository.getLines(db, id));
                setDocType(doc.type);
            } else requireAccess('document.create');
            setScanDocumentId(id);
        },
        [db, requireAccess],
    );
    const createDraft = useCallback(
        (type: DocumentType) =>
            mutate(async () => {
                requireAccess('document.create');
                const id = uuid();
                await DocumentRepository.createDraft(db, {
                    id,
                    type,
                    warehouse: warehouseId(warehouse),
                    createdAt: new Date().toISOString(),
                    createdBy: user?.id,
                });
                await refreshDocs();
                return id;
            }),
        [db, mutate, refreshDocs, requireAccess, user, warehouse],
    );
    const addItem = useCallback(
        (product: Product, amount: number) =>
            mutate(async () => {
                if (!Number.isFinite(amount) || amount <= 0) throw new Error('Введіть коректну кількість товару.');
                const id = scanDocumentId ?? ACTIVE_DOCUMENT_ID;
                const doc = scanDocumentId ? await DocumentRepository.get(db, scanDocumentId) : undefined;
                if (scanDocumentId && !doc) throw new Error('Документ не знайдено.');
                requireAccess('document.edit', doc ?? undefined);
                const rows = await addProductToDocument(db, id, product, amount, Platform.OS);
                if (scanDocumentId) setTargetItems(rows);
                else setItems(rows);
                await refreshDocs();
            }),
        [db, mutate, scanDocumentId, requireAccess, refreshDocs],
    );
    const applyDelta = useCallback(
        async (item: DocumentItem, delta: number) => {
            const row = await db.getFirstAsync<{ quantity: number }>('SELECT quantity FROM lines WHERE id=?', [
                item.line_id ?? -1,
            ]);
            if (!row) throw new Error('Позицію не знайдено.');
            const next = Number(row.quantity) + delta;
            if (next <= 0) await DocumentRepository.deleteLine(db, item.line_id ?? -1);
            else await DocumentRepository.setLineQuantity(db, item.line_id ?? -1, next);
        },
        [db],
    );
    const changeItemQuantity = useCallback(
        (item: DocumentItem, delta: number) =>
            mutate(async () => {
                requireAccess('document.edit');
                await applyDelta(item, delta);
                setItems(await DocumentRepository.getLines(db));
            }),
        [applyDelta, db, mutate, requireAccess],
    );
    const changeSavedItemQuantity = useCallback(
        (id: string, _rows: DocumentItem[], item: DocumentItem, delta: number) =>
            mutate(async () => {
                const doc = await DocumentRepository.get(db, id);
                if (!doc) throw new Error('Документ не знайдено.');
                requireAccess('document.edit', doc);
                await db.withTransactionAsync(async () => {
                    await applyDelta(item, delta);
                    await queueSavedDocument(db, id, Platform.OS);
                });
                const rows = await DocumentRepository.getLines(db, id);
                if (id === scanDocumentId) setTargetItems(rows);
                await refreshDocs();
                return rows;
            }),
        [db, applyDelta, mutate, requireAccess, refreshDocs, scanDocumentId],
    );
    const loadItems = useCallback((id: string) => DocumentRepository.getLines(db, id), [db]);
    const saveCurrent = useCallback(
        (status: 'draft' | 'posted', selectedWarehouse: string) =>
            mutate(async () => {
                requireAccess(status === 'posted' ? 'document.post' : 'document.create');
                const rows = await DocumentRepository.getLines(db);
                if (!rows.length) throw new Error('Спочатку додайте хоча б один товар.');
                const id = uuid(),
                    createdAt = new Date().toISOString();
                const payload = buildSyncPayload({
                    id,
                    type: docType,
                    status,
                    warehouse: warehouseId(selectedWarehouse),
                    note: docNote,
                    createdAt,
                    items: rows,
                    deviceId: Platform.OS,
                });
                await DocumentRepository.saveActive(db, {
                    id,
                    type: docType,
                    status,
                    warehouse: warehouseId(selectedWarehouse),
                    note: docNote,
                    createdAt,
                    payload: JSON.stringify(payload),
                    createdBy: user?.id,
                });
                setItems([]);
                setDocNote('');
                await refreshDocs();
                return id;
            }),
        [db, docNote, docType, mutate, refreshDocs, requireAccess, user],
    );
    const postSaved = useCallback(
        (id: string) =>
            mutate(async () => {
                const doc = await DocumentRepository.get(db, id);
                if (!doc) throw new Error('Документ не знайдено.');
                requireAccess('document.post', doc);
                if (doc.status !== 'draft') throw new Error('Провести можна лише чернетку.');
                if (!(await DocumentRepository.getLines(db, id)).length) throw new Error('Документ порожній.');
                await db.withTransactionAsync(async () => {
                    await DocumentRepository.setStatus(db, id, 'posted');
                    await queueSavedDocument(db, id, Platform.OS);
                });
                await refreshDocs();
            }),
        [db, mutate, refreshDocs, requireAccess],
    );
    const deleteDocument = useCallback(
        (id: string) =>
            mutate(async () => {
                const doc = await DocumentRepository.get(db, id);
                if (!doc) throw new Error('Документ не знайдено.');
                requireAccess('document.delete', doc);
                await DocumentRepository.delete(db, id);
                if (scanDocumentId === id) {
                    setScanDocumentId(null);
                    setTargetItems([]);
                }
                await refreshDocs();
            }),
        [db, mutate, refreshDocs, requireAccess, scanDocumentId],
    );
    const clearCurrent = useCallback(
        () =>
            mutate(async () => {
                requireAccess('document.edit');
                await DocumentRepository.clearActive(db);
                setItems([]);
            }),
        [db, mutate, requireAccess],
    );
    const resolveConflict = useCallback(
        (id: string) =>
            mutate(async () => {
                const doc = await DocumentRepository.get(db, id);
                if (!doc) throw new Error('Документ не знайдено.');
                // Managers can reopen a conflicted document; server still verifies its version on sync.
                requireAccess('document.post', doc);
                await DocumentRepository.setStatus(db, id, 'draft');
                await refreshDocs();
            }),
        [db, mutate, refreshDocs, requireAccess],
    );
    const value = useMemo<InventoryContextValue>(
        () => ({
            docType,
            setDocType,
            quantity,
            setQuantity,
            items,
            scanItems: scanDocumentId ? targetItems : items,
            scanDocumentId,
            selectScanDocument,
            createDraft,
            docNote,
            setDocNote,
            savedDocs,
            outboxCount,
            refreshDocs,
            addItem,
            changeItemQuantity,
            changeSavedItemQuantity,
            loadItems,
            saveCurrent,
            postSaved,
            deleteDocument,
            clearCurrent,
            resolveConflict,
        }),
        [
            docType,
            quantity,
            items,
            targetItems,
            scanDocumentId,
            selectScanDocument,
            createDraft,
            docNote,
            savedDocs,
            outboxCount,
            refreshDocs,
            addItem,
            changeItemQuantity,
            changeSavedItemQuantity,
            loadItems,
            saveCurrent,
            postSaved,
            deleteDocument,
            clearCurrent,
            resolveConflict,
        ],
    );
    return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}
export function useInventory(): InventoryContextValue {
    const value = useContext(InventoryContext);
    if (!value) throw new Error('useInventory must be used inside InventoryProvider');
    return value;
}
