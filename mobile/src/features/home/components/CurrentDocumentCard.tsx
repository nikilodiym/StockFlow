import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppStyles } from '../../../constants/styles';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/ui/Icon';
import { totalQuantity, TYPE_LABEL } from '../../inventory/services/DocumentService';
import type { DocumentItem, DocumentType } from '../../inventory/types/document.types';
type Props = { type: DocumentType; items: DocumentItem[]; onOpen: () => void; onScan: () => void };
export default function CurrentDocumentCard({ type, items, onOpen, onScan }: Props) {
    const s = useAppStyles();
    return (
        <View style={s.documentCurrent}>
            <Pressable style={[s.rowBetween, { gap: 12 }]} onPress={items.length ? onOpen : onScan}>
                <Text style={[s.cardTitle, { flex: 1 }]}>Поточний документ</Text>
                <Text style={s.productName}>{items.length ? TYPE_LABEL[type] : 'Не обрано'}</Text>
                <Icon name="chevronDown" size={20} />
            </Pressable>
            {items.length > 0 && (
                <Text style={s.mutedSmall}>
                    {items.length} позицій · {totalQuantity(items)} од.
                </Text>
            )}
            <Button variant="scan" icon="scan" label="Сканувати штрих-код" onPress={onScan} />
            <Text style={s.centerCaption}>Скануйте штрихкод або введіть його вручну</Text>
        </View>
    );
}
