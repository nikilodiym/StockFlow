/**
 * State of the warehouse documents: the document being scanned now ("current"),
 * saved documents and the outbox counter. Shared by Home, Documents, Detail, Scanner, Search.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { uuid } from '../../../utils/formatters';
import type { Product } from '../../products/types/product.types';
import { DocumentRepository } from '../repositories/DocumentRepository';
import { buildSyncPayload, markPayloadPosted, warehouseId } from '../services/DocumentService';
import type { DocumentItem, DocumentType, SavedDocument } from '../types/document.types';

type InventoryContextValue = {
    /** Type of the current document (and the selected tab on the Documents screen). */
    docType: DocumentType;
    setDocType: (type: DocumentType) => void;
    /** Quantity added per scan (scanner +1/+10 buttons). */
    quantity: string;
    setQuantity: (value: string) => void;
    items: DocumentItem[];
    docNote: string;
    setDocNote: (value: string) => void;
    savedDocs: SavedDocument[];
    outboxCount: number;
    refreshDocs: () => Promise<void>;
    addItem: (product: Product, quantity: number) => Promise<void>;
    /** delta ±1 on a line of the current document. */
    changeItemQuantity: (item: DocumentItem, delta: number) => Promise<void>;
    /** delta ±1 on a line of a saved document; returns the updated list. */
    changeSavedItemQuantity: (docItems: DocumentItem[], item: DocumentItem, delta: number) => Promise<DocumentItem[]>;
    loadItems: (documentId: string) => Promise<DocumentItem[]>;
    saveCurrent: (status: 'draft' | 'posted', warehouse: string) => Promise<string>;
    postSaved: (documentId: string) => Promise<void>;
    deleteDocument: (documentId: string) => Promise<void>;
    clearCurrent: () => Promise<void>;
    resolveConflict: (documentId: string) => Promise<void>;
};

const InventoryContext = createContext<InventoryContextValue | null>(null);

export function InventoryProvider({ children }: { children: React.ReactNode }) {
    const db = useSQLiteContext();
    const [docType, setDocType] = useState<DocumentType>('receipt');
    const [quantity, setQuantity] = useState('1');
    const [items, setItems] = useState<DocumentItem[]>([]);
    const [docNote, setDocNote] = useState('');
    const [savedDocs, setSavedDocs] = useState<SavedDocument[]>([]);
    const [outboxCount, setOutboxCount] = useState(0);

    const refreshDocs = useCallback(async () => {
        const [docs, queued] = await Promise.all([DocumentRepository.list(db), DocumentRepository.outboxCount(db)]);
        setSavedDocs(docs);
        setOutboxCount(queued);
    }, [db]);

    useEffect(() => {
        let active = true;
        Promise.all([DocumentRepository.getLines(db), refreshDocs()])
            .then(([lines]) => { if (active) setItems(lines); })
            .catch(error => { if (active) console.error('Помилка бази даних:', error); });
        return () => { active = false; };
    }, [db, refreshDocs]);

    const addItem = useCallback(async (product: Product, amount: number) => {
        const existing = items.find(item => item.id === product.id);
        if (existing?.line_id) {
            const next = Number(existing.quantity) + amount;
            await DocumentRepository.setLineQuantity(db, existing.line_id, next);
            setItems(prev => prev.map(item => (item.line_id === existing.line_id ? { ...item, quantity: next } : item)));
        } else {
            const lineId = await DocumentRepository.insertLine(db, product.id, amount, product.unit || 'шт');
            setItems(prev => [...prev, { ...product, quantity: amount, line_id: lineId }]);
        }
    }, [db, items]);

    const applyDelta = useCallback(async (list: DocumentItem[], item: DocumentItem, delta: number): Promise<DocumentItem[]> => {
        const next = Number(item.quantity) + delta;
        if (next <= 0) {
            await DocumentRepository.deleteLine(db, item.line_id ?? -1);
            return list.filter(x => x.line_id !== item.line_id);
        }
        await DocumentRepository.setLineQuantity(db, item.line_id ?? -1, next);
        return list.map(x => (x.line_id === item.line_id ? { ...x, quantity: next } : x));
    }, [db]);

    const changeItemQuantity = useCallback(async (item: DocumentItem, delta: number) => {
        setItems(await applyDelta(items, item, delta));
    }, [applyDelta, items]);

    const changeSavedItemQuantity = useCallback(async (docItems: DocumentItem[], item: DocumentItem, delta: number) =>
        applyDelta(docItems, item, delta), [applyDelta]);

    const loadItems = useCallback((documentId: string) => DocumentRepository.getLines(db, documentId), [db]);

    const saveCurrent = useCallback(async (status: 'draft' | 'posted', warehouse: string) => {
        const id = uuid();
        const createdAt = new Date().toISOString();
        const payload = buildSyncPayload({ id, type: docType, status, warehouse: warehouseId(warehouse), note: docNote, createdAt, items, deviceId: Platform.OS });
        await DocumentRepository.saveActive(db, { id, type: docType, status, warehouse: warehouseId(warehouse), note: docNote, createdAt, payload: JSON.stringify(payload) });
        setItems([]);
        setDocNote('');
        await refreshDocs();
        return id;
    }, [db, docNote, docType, items, refreshDocs]);

    const postSaved = useCallback(async (documentId: string) => {
        await DocumentRepository.setStatus(db, documentId, 'posted');
        const queued = await DocumentRepository.getOutbox(db, documentId);
        if (queued) await DocumentRepository.updateOutbox(db, documentId, markPayloadPosted(queued.payload));
        await refreshDocs();
    }, [db, refreshDocs]);

    const deleteDocument = useCallback(async (documentId: string) => {
        await DocumentRepository.delete(db, documentId);
        await refreshDocs();
    }, [db, refreshDocs]);

    const clearCurrent = useCallback(async () => {
        await DocumentRepository.clearActive(db);
        setItems([]);
    }, [db]);

    const resolveConflict = useCallback(async (documentId: string) => {
        await DocumentRepository.setStatus(db, documentId, 'draft');
        await refreshDocs();
    }, [db, refreshDocs]);

    const value = useMemo<InventoryContextValue>(() => ({
        docType, setDocType, quantity, setQuantity, items, docNote, setDocNote, savedDocs, outboxCount, refreshDocs,
        addItem, changeItemQuantity, changeSavedItemQuantity, loadItems, saveCurrent, postSaved, deleteDocument, clearCurrent, resolveConflict,
    }), [docType, quantity, items, docNote, savedDocs, outboxCount, refreshDocs, addItem, changeItemQuantity, changeSavedItemQuantity, loadItems, saveCurrent, postSaved, deleteDocument, clearCurrent, resolveConflict]);

    return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}

export function useInventory(): InventoryContextValue {
    const context = useContext(InventoryContext);
    if (!context) throw new Error('useInventory must be used inside InventoryProvider');
    return context;
}
