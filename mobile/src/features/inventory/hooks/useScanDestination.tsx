import React, { useState } from 'react';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { usePermissions } from '../../../hooks/usePermissions';
import DocumentPickerSheet from '../components/DocumentPickerSheet';
import NewDocumentSheet from '../components/NewDocumentSheet';
import { useInventory } from './useInventory';
import { TYPE_LABEL, warehouseId } from '../services/DocumentService';
import type { DocumentType } from '../types/document.types';

export function useScanDestination(onReady: (id: string | null) => void) {
    const { savedDocs, items, docType, refreshDocs, selectScanDocument, createDraft } = useInventory();
    const { warehouse } = useSettings();
    const { requirePermission, reportError } = usePermissions();
    const [visible, setVisible] = useState(false),
        [creating, setCreating] = useState(false);
    const open = async () => {
        try {
            requirePermission('document.create');
            await refreshDocs();
            setVisible(true);
        } catch (e) {
            reportError(e);
        }
    };
    const choose = async (id: string | null) => {
        setVisible(false);
        try {
            await selectScanDocument(id);
            onReady(id);
        } catch (e) {
            reportError(e);
        }
    };
    const create = async (type: DocumentType) => {
        setCreating(false);
        try {
            const id = await createDraft(type);
            await selectScanDocument(id);
            onReady(id);
        } catch (e) {
            reportError(e);
        }
    };
    const sheets = (
        <>
            <DocumentPickerSheet
                visible={visible}
                title="Куди додавати скани?"
                subtitle="Оберіть чернетку або створіть документ."
                documents={savedDocs.filter(
                    (d) => d.status === 'draft' && (!d.warehouse || d.warehouse === warehouseId(warehouse)),
                )}
                current={items.length ? { title: `Поточний · ${TYPE_LABEL[docType]}`, count: items.length } : undefined}
                onClose={() => setVisible(false)}
                onSelect={(id) => void choose(id)}
                onNew={() => {
                    setVisible(false);
                    setCreating(true);
                }}
            />
            <NewDocumentSheet
                visible={creating}
                onClose={() => setCreating(false)}
                onSelect={(type) => void create(type)}
            />
        </>
    );
    return { open: () => void open(), sheets };
}
