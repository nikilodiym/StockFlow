import React, { useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { WAREHOUSES } from '../../../constants/config';
import { usePermissions } from '../../../hooks/usePermissions';
import DocumentPickerSheet from '../components/DocumentPickerSheet';
import { DocumentRepository } from '../repositories/DocumentRepository';
import { documentLabel, TYPE_LABEL } from '../services/DocumentService';
import { printDocument } from '../services/PrintService';
import { useInventory } from './useInventory';

export function useDocumentPrinting() {
    const db = useSQLiteContext();
    const { warehouse } = useSettings();
    const { items, docType, docNote, savedDocs, refreshDocs } = useInventory();
    const { requirePermission, reportError } = usePermissions();
    const [visible, setVisible] = useState(false);
    const busy = useRef(false);
    const print = async (id?: string) => {
        if (busy.current) return;
        busy.current = true;
        try {
            const doc = id ? await DocumentRepository.get(db, id) : null;
            if (id && !doc) throw new Error('Документ не знайдено.');
            requirePermission('document.print', doc ?? undefined);
            const rows = id ? await DocumentRepository.getLines(db, id) : items;
            if (!rows.length) throw new Error('Додайте хоча б один товар до документа перед друком.');
            await printDocument({
                title: doc
                    ? `${documentLabel(doc)} · ${TYPE_LABEL[doc.type]}`
                    : `${TYPE_LABEL[docType]} · Поточний документ`,
                warehouse: doc?.warehouse
                    ? (WAREHOUSES.find((w) => w.id === doc.warehouse)?.name ?? `Склад №${doc.warehouse}`)
                    : warehouse,
                status: doc?.status === 'posted' ? 'Проведено' : 'Чернетка',
                createdAt: doc?.created_at ?? new Date().toISOString(),
                note: doc?.note ?? docNote,
                items: rows,
            });
        } catch (error) {
            if (!/cancel|canceled|cancelled/i.test(error instanceof Error ? error.message : ''))
                reportError(error, 'Не вдалося надрукувати документ');
        } finally {
            busy.current = false;
        }
    };
    const open = async () => {
        try {
            requirePermission('document.print');
            await refreshDocs();
            setVisible(true);
        } catch (e) {
            reportError(e);
        }
    };
    const picker = (
        <DocumentPickerSheet
            visible={visible}
            title="Друк документів"
            subtitle="Оберіть документ для попереднього перегляду та друку."
            documents={savedDocs}
            current={items.length ? { title: 'Поточний документ', count: items.length } : undefined}
            onClose={() => setVisible(false)}
            onSelect={(id) => {
                setVisible(false);
                void print(id ?? undefined);
            }}
        />
    );
    return { print, open: () => void open(), picker };
}
