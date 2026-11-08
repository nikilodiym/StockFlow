import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import s from '../../../constants/styles';
import { colors } from '../../../constants/colors';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/ui/Icon';
import Header, { HeaderIconButton } from '../../../components/layout/Header';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { useSettings } from '../../../app/providers/SettingsProvider';
import DocumentCard from '../components/DocumentCard';
import DocumentFilters from '../components/DocumentFilters';
import { DocumentItemList } from '../components/DocumentItemRow';
import NewDocumentSheet from '../components/NewDocumentSheet';
import { useInventory } from '../hooks/useInventory';
import { filterDocuments } from '../services/DocumentService';
import { usePermissions } from '../../../hooks/usePermissions';
import type { DateFilter, DocumentType, SavedDocument, StatusFilter } from '../types/document.types';

/** Documents tab: filters, saved documents of the selected type, current document. */
export default function DocumentsScreen() {
    const navigation = useNavigation();
    const { warehouse } = useSettings();
    const { docType, setDocType, savedDocs, items, refreshDocs, changeItemQuantity, createDraft } = useInventory();
    const [status, setStatus] = useState<StatusFilter>('Усі стани');
    const [date, setDate] = useState<DateFilter>('Усі дати');
    const [sheetVisible, setSheetVisible] = useState(false);
    const { reportError } = usePermissions();

    useFocusEffect(
        useCallback(() => {
            void refreshDocs();
        }, [refreshDocs]),
    );

    const visibleDocs = filterDocuments(savedDocs, docType, status, date);
    const openDoc = (doc: SavedDocument) => {
        setDocType(doc.type);
        navigation.navigate('DocumentDetail', { docId: doc.id });
    };
    const startDoc = async (kind: DocumentType) => {
        setSheetVisible(false);
        try {
            const id = await createDraft(kind);
            setDocType(kind);
            navigation.navigate('DocumentDetail', { docId: id });
        } catch (e) {
            reportError(e);
        }
    };
    const newDoc = () => setSheetVisible(true);

    return (
        <ScreenContainer withTabBar>
            <Header
                title="Документи"
                right={
                    <HeaderIconButton label="Новий документ" onPress={newDoc}>
                        <Icon name="plus" size={20} color={colors.text} />
                    </HeaderIconButton>
                }
            />
            <ScrollView contentContainerStyle={s.pageBody}>
                <DocumentFilters
                    docType={docType}
                    onDocType={setDocType}
                    status={status}
                    onStatus={setStatus}
                    date={date}
                    onDate={setDate}
                    docs={savedDocs}
                />
                {visibleDocs.map((doc) => (
                    <DocumentCard key={doc.id} doc={doc} warehouse={warehouse} onPress={openDoc} coloredStatus />
                ))}
                {savedDocs.filter((doc) => doc.type === docType).length === 0 && (
                    <View style={s.emptyState}>
                        <Icon name="file" size={28} color={colors.primary} />
                        <Text style={s.emptyTitle}>Документів поки немає</Text>
                        <Text style={s.mutedCenter}>Створіть перший документ для цього типу</Text>
                        <Button label="＋ Створити документ" onPress={newDoc} />
                    </View>
                )}
                <Text style={s.sectionLabel}>ПОТОЧНИЙ ДОКУМЕНТ · {items.length}</Text>
                <DocumentItemList items={items} onChange={(item, delta) => void changeItemQuantity(item, delta)} />
                <Button
                    variant="scan"
                    label="Відкрити поточний документ"
                    onPress={() => navigation.navigate('DocumentDetail', {})}
                />
            </ScrollView>
            <Pressable accessibilityLabel="Новий документ" style={s.fab} onPress={newDoc}>
                <Icon name="plus" size={25} color={colors.textStrong} strokeWidth={2.2} />
            </Pressable>
            <NewDocumentSheet
                visible={sheetVisible}
                onClose={() => setSheetVisible(false)}
                onSelect={(kind) => void startDoc(kind)}
            />
        </ScreenContainer>
    );
}
