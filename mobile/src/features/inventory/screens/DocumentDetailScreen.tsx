import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import s from '../../../constants/styles';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Header, { HeaderIconButton } from '../../../components/layout/Header';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { useSettings } from '../../../app/providers/SettingsProvider';
import type { RootScreenProps } from '../../../app/navigation/types';
import { dateLabel } from '../../../utils/formatters';
import { DocumentItemList } from '../components/DocumentItemRow';
import { useDocumentActions } from '../hooks/useDocumentActions';
import { useInventory } from '../hooks/useInventory';
import { totalQuantity, TYPE_LABEL } from '../services/DocumentService';
import type { DocumentItem } from '../types/document.types';

/** A document: the current one (no docId) or a saved one. */
export default function DocumentDetailScreen({ navigation, route }: RootScreenProps<'DocumentDetail'>) {
    const docId = route.params?.docId;
    const { warehouse } = useSettings();
    const { docType, items, docNote, setDocNote, savedDocs, loadItems, changeItemQuantity, changeSavedItemQuantity } = useInventory();
    const { post, remove } = useDocumentActions(docId);
    const [savedItems, setSavedItems] = useState<DocumentItem[]>([]);

    const saved = docId ? savedDocs.find(d => d.id === docId) : undefined;
    const type = saved?.type ?? docType;
    const rows = docId ? savedItems : items;
    const editable = !docId || saved?.status === 'draft';
    const title = docId
        ? `${TYPE_LABEL[type]} · ${dateLabel(saved?.created_at ?? new Date().toISOString())}`
        : `${TYPE_LABEL[type]} · Чернетка`;

    useFocusEffect(useCallback(() => {
        if (docId) void loadItems(docId).then(setSavedItems);
    }, [docId, loadItems]));

    const onChange = (item: DocumentItem, delta: number) => {
        if (!docId) void changeItemQuantity(item, delta);
        else if (saved?.status === 'draft') void changeSavedItemQuantity(savedItems, item, delta).then(setSavedItems);
    };

    const share = () => void Share.share({ title, message: `${title}\n${rows.map(i => `${i.name} — ${i.quantity} ${i.unit}`).join('\n')}` });

    return (
        <ScreenContainer>
            <Header
                back
                title={title}
                right={
                    <View style={s.headerActions}>
                        <HeaderIconButton label="Поділитися" onPress={share}><Text style={s.iconButtonText}>⎙</Text></HeaderIconButton>
                        <HeaderIconButton label="Видалити" onPress={remove}><Text style={s.iconButtonText}>⌫</Text></HeaderIconButton>
                    </View>
                }
            />
            <ScrollView contentContainerStyle={s.pageBody}>
                <View style={s.detailHeading}>
                    <Text style={s.detailTitle}>{title}</Text>
                    <Text style={s.mutedSmall}>{warehouse}</Text>
                    <Text style={[s.statusPill, saved?.status === 'conflict' && s.statusError]}>
                        {docId ? (saved?.status === 'posted' ? 'Проведено' : 'Чернетка') : 'Локально'}
                    </Text>
                </View>
                <View style={s.detailStats}>
                    <View style={s.detailStat}><Text style={s.detailStatLabel}>Позицій</Text><Text style={s.detailStatValue}>{rows.length}</Text></View>
                    <View style={s.detailStat}><Text style={s.detailStatLabel}>Загальна кількість</Text><Text style={s.detailStatValue}>{totalQuantity(rows)}</Text></View>
                    {type === 'inventory' && <View style={s.detailStat}><Text style={s.detailStatLabel}>Розбіжність</Text><Text style={[s.detailStatValue, s.errorText]}>+5</Text></View>}
                </View>
                <Text style={s.sectionLabel}>ВІДСКАНОВАНІ ТОВАРИ</Text>
                <DocumentItemList items={rows} onChange={editable ? onChange : undefined} />
                {type === 'writeoff' && <Input label="ПРИЧИНА СПИСАННЯ" placeholder="Наприклад, брак" value={docNote} onChangeText={setDocNote} />}
                <Button variant="scan" icon="scan" label="Сканувати штрих-код" onPress={() => navigation.navigate('Scanner')} />
                {docId && saved?.status === 'conflict' && (
                    <Pressable style={s.dangerButton} onPress={() => navigation.navigate('Conflict', { docId })}><Text style={s.dangerText}>Розв’язати конфлікт</Text></Pressable>
                )}
            </ScrollView>
            <View style={s.stickyActions}>
                <Button label="Провести" onPress={() => void post()} />
                <Button variant="secondary" icon="scan" label="Сканувати штрих-код" onPress={() => navigation.navigate('Scanner')} />
            </View>
        </ScreenContainer>
    );
}
