import React from 'react';
import { Pressable, Text, View } from 'react-native';
import s from '../../../constants/styles';
import Button from '../../../components/ui/Button';
import { totalQuantity, TYPE_LABEL } from '../../inventory/services/DocumentService';
import type { DocumentItem, DocumentType } from '../../inventory/types/document.types';

type Props = { type: DocumentType; items: DocumentItem[]; onOpen: () => void; onScan: () => void };

/** The document being scanned right now. */
export default function CurrentDocumentCard({ type, items, onOpen, onScan }: Props) {
    return (
        <View style={s.documentCurrent}>
            <View style={s.rowBetween}>
                <Text style={s.cardTitle}>Поточний документ</Text>
                <Text style={s.linkText}>{TYPE_LABEL[type]}</Text>
            </View>
            <Text style={s.mutedSmall}>{items.length} позицій · {totalQuantity(items)} од.</Text>
            {items.length > 0 && (
                <Pressable style={s.documentHeadlineButton} onPress={onOpen}><Text style={s.linkText}>Переглянути документ  ›</Text></Pressable>
            )}
            <Button variant="scan" icon="scan" label="Сканувати штрих-код" onPress={onScan} />
        </View>
    );
}
