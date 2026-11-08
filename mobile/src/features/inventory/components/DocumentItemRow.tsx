import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppStyles } from '../../../constants/styles';
import { colors } from '../../../constants/colors';
import Icon from '../../../components/ui/Icon';
import type { DocumentItem } from '../types/document.types';

type Props = {
    item: DocumentItem;
    /** With −/＋ buttons when the document can be edited. */
    onChange?: (item: DocumentItem, delta: number) => void;
};

/** One scanned product of a document. */
export default function DocumentItemRow({ item, onChange }: Props) {
    const s = useAppStyles();

    return (
        <View style={[s.productRow, { flexWrap: 'wrap' }]}>
            <View style={[s.productInfo, { minWidth: 120 }]}>
                <Text style={s.actionTitle}>{item.name}</Text>
                <Text style={s.hint}>
                    {item.sku} · {item.barcode}
                </Text>
            </View>
            {onChange ? (
                <View style={s.qtyControl}>
                    <Pressable style={s.qtyButton} onPress={() => onChange(item, -1)}>
                        <Icon name="minus" size={18} />
                    </Pressable>
                    <Text style={s.qtyNumber}>{item.quantity}</Text>
                    <Pressable style={s.qtyButton} onPress={() => onChange(item, 1)}>
                        <Icon name="plus" size={18} />
                    </Pressable>
                    <Pressable
                        accessibilityLabel="Видалити позицію"
                        style={s.qtyButton}
                        onPress={() => onChange(item, -item.quantity)}
                    >
                        <Icon name="trash" size={22} color="#D64545" />
                    </Pressable>
                </View>
            ) : (
                <Text style={s.qty}>
                    {item.quantity} {item.unit}
                </Text>
            )}
        </View>
    );
}

export function DocumentItemList({ items, onChange }: { items: DocumentItem[]; onChange?: Props['onChange'] }) {
    return (
        <>
            {items.map((item, i) => (
                <DocumentItemRow key={item.line_id ?? `${item.id}-${i}`} item={item} onChange={onChange} />
            ))}
        </>
    );
}
