import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Header, { HeaderIconButton } from '../../../components/layout/Header';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/ui/Icon';
import Input from '../../../components/ui/Input';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { useSync } from '../../../app/providers/SyncProvider';
import { WAREHOUSES } from '../../../constants/config';
import { usePermissions } from '../../../hooks/usePermissions';
import type { RootScreenProps } from '../../../app/navigation/types';
import { dateLabel, csvCell } from '../../../utils/formatters';
import { DocumentItemList } from '../components/DocumentItemRow';
import { useDocumentActions } from '../hooks/useDocumentActions';
import { useDocumentPrinting } from '../hooks/useDocumentPrinting';
import { useInventory } from '../hooks/useInventory';
import { documentLabel, totalQuantity, TYPE_LABEL } from '../services/DocumentService';
import type { DocumentItem } from '../types/document.types';

export default function DocumentDetailScreen({ navigation, route }: RootScreenProps<'DocumentDetail'>) {
    const docId = route.params?.docId;
    const { warehouse } = useSettings();
    const {
        docType,
        items,
        docNote,
        setDocNote,
        savedDocs,
        loadItems,
        changeItemQuantity,
        changeSavedItemQuantity,
        selectScanDocument,
        refreshDocs,
    } = useInventory();
    const { post, remove, saveCurrentDocument } = useDocumentActions(docId);
    const printing = useDocumentPrinting();
    const { sync } = useSync();
    const { reportError } = usePermissions();
    const [savedItems, setSavedItems] = useState<DocumentItem[]>([]);
    const saved = docId ? savedDocs.find((d) => d.id === docId) : undefined;
    const type = saved?.type ?? docType,
        rows = docId ? savedItems : items;
    const editable = !docId || saved?.status === 'draft';
    const title = `${TYPE_LABEL[type]} · ${dateLabel(saved?.created_at ?? new Date().toISOString())}`;
    const selectedWarehouse = WAREHOUSES.find((w) => w.id === saved?.warehouse)?.name ?? warehouse;
    useFocusEffect(
        useCallback(() => {
            let active = true;
            void refreshDocs().catch((e) => {
                if (active) reportError(e);
            });
            if (docId)
                void loadItems(docId)
                    .then((rows) => {
                        if (active) setSavedItems(rows);
                    })
                    .catch((e) => {
                        if (active) reportError(e);
                    });
            return () => {
                active = false;
            };
        }, [docId, loadItems, refreshDocs]),
    );
    const change = async (item: DocumentItem, delta: number) => {
        try {
            if (!docId) await changeItemQuantity(item, delta);
            else setSavedItems(await changeSavedItemQuantity(docId, savedItems, item, delta));
        } catch (e) {
            reportError(e);
        }
    };
    const open = (screen: 'Scanner' | 'Search') => {
        void selectScanDocument(docId ?? null)
            .then(() => navigation.navigate(screen))
            .catch((e) => reportError(e));
    };
    const exportCsv = () =>
        void Share.share({
            title,
            message: [
                'SKU,Barcode,Name,Quantity,Unit',
                ...rows.map((i) => [i.sku, i.barcode, csvCell(i.name), i.quantity, i.unit].join(',')),
            ].join('\n'),
        });
    return (
        <ScreenContainer>
            <Header
                back
                title=""
                right={
                    <View style={s.actions}>
                        {!docId && (
                            <HeaderIconButton label="Зберегти чернетку" onPress={() => void saveCurrentDocument()}>
                                <Icon name="file" size={20} />
                            </HeaderIconButton>
                        )}
                        <HeaderIconButton label="Друк документа" onPress={() => void printing.print(docId)}>
                            <Icon name="printer" size={20} />
                        </HeaderIconButton>
                        <HeaderIconButton label="Видалити документ" onPress={remove}>
                            <Icon name="trash" size={20} />
                        </HeaderIconButton>
                    </View>
                }
            />
            <ScrollView contentContainerStyle={s.body}>
                <View style={s.heading}>
                    <Text style={s.title}>{title}</Text>
                    <Text style={s.number}>{saved ? documentLabel(saved) : 'Новий'}</Text>
                </View>
                <View style={s.metaRow}>
                    <Text
                        style={[
                            s.status,
                            saved?.status === 'conflict' && s.conflict,
                            saved?.is_synced === 1 && saved.status !== 'draft' && s.synced,
                        ]}
                    >
                        {saved?.status === 'conflict'
                            ? 'Конфлікт синхронізації'
                            : saved?.status === 'posted'
                              ? 'Проведено'
                              : 'Чернетка'}
                    </Text>
                    <Text style={s.warehouse}>{selectedWarehouse}</Text>
                </View>
                <View style={s.stats}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.statLabel}>Позицій</Text>
                        <Text style={s.statValue}>{rows.length}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={s.statLabel}>Загальна кількість</Text>
                        <Text style={s.statValue}>{totalQuantity(rows)}</Text>
                    </View>
                </View>
                <Text style={s.label}>{type === 'receipt' ? 'Товари з накладної' : 'Відскановані товари'}</Text>
                <DocumentItemList
                    items={rows}
                    onChange={editable ? (item, delta) => void change(item, delta) : undefined}
                />
                {!rows.length && (
                    <View style={s.empty}>
                        <Icon name="file" size={42} color="#A2ACB6" />
                        <Text style={s.emptyText}>Поки порожньо.</Text>
                        <Text style={s.emptyText}>Додайте товари скануванням або вручну.</Text>
                        <Pressable onPress={() => open('Search')}>
                            <Text style={s.link}>Додати вручну</Text>
                        </Pressable>
                    </View>
                )}
                {editable && type === 'writeoff' && (
                    <Input
                        label="Причина списання"
                        placeholder="Наприклад, брак"
                        value={docNote}
                        onChangeText={setDocNote}
                    />
                )}
            </ScrollView>
            <View style={s.footer}>
                {saved?.status === 'conflict' ? (
                    <Button
                        label="Розв’язати конфлікт"
                        onPress={() => navigation.navigate('Conflict', { docId: docId! })}
                    />
                ) : editable ? (
                    <>
                        <Button label="Провести" disabled={!rows.length} onPress={() => void post()} />
                        <Button
                            variant="secondary"
                            icon="scan"
                            label="Сканувати штрих-код"
                            onPress={() => open('Scanner')}
                        />
                        {!!rows.length && (
                            <Pressable style={{ alignSelf: 'center', paddingTop: 8 }} onPress={() => open('Search')}>
                                <Text style={s.link}>Додати товар вручну</Text>
                            </Pressable>
                        )}
                    </>
                ) : saved?.is_synced ? (
                    <Button variant="secondary" icon="download" label="Експорт CSV" onPress={exportCsv} />
                ) : (
                    <Button label="Синхронізувати" onPress={() => void sync()} />
                )}
            </View>
            {printing.picker}
        </ScreenContainer>
    );
}
const s = StyleSheet.create({
    actions: { flexDirection: 'row', gap: 8 },
    body: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 20, flexGrow: 1 },
    heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    title: { fontSize: 20, fontWeight: '500', color: '#182021', flex: 1 },
    number: { fontSize: 18, fontWeight: '500', color: '#182021' },
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    status: {
        fontSize: 10,
        color: '#A98312',
        backgroundColor: '#FFF2CC',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 5,
        overflow: 'hidden',
    },
    conflict: { color: '#DF4949', backgroundColor: '#FDE2E2' },
    synced: { color: '#16816A', backgroundColor: '#D8F2E4' },
    warehouse: { fontSize: 11, color: '#667085' },
    stats: { flexDirection: 'row', gap: 16, backgroundColor: '#fff', padding: 16, borderRadius: 14, marginTop: 16 },
    statLabel: { fontSize: 11, color: '#667085' },
    statValue: { fontSize: 20, fontWeight: '600', color: '#172222', marginTop: 6 },
    label: { fontSize: 12, color: '#667085', marginTop: 18, marginBottom: 8 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 70 },
    emptyText: { fontSize: 14, color: '#667085', marginTop: 6 },
    link: { fontSize: 14, color: '#12715B', marginTop: 6 },
    footer: { paddingHorizontal: 16, paddingBottom: 12 },
});
