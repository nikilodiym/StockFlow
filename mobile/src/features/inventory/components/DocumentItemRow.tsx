import React from 'react';
import { Pressable, Text, View } from 'react-native';
import s from '../../../constants/styles';
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
    return (
        <View style={s.productRow}>
            <View style={s.productBadge}><Icon name="file" size={17} color={colors.primary} /></View>
            <View style={s.productInfo}>
                <Text style={s.actionTitle}>{item.name}</Text>
                <Text style={s.hint}>{item.sku} · {item.barcode}</Text>
            </View>
            {onChange ? (
                <View style={s.qtyControl}>
                    <Pressable style={s.qtyButton} onPress={() => onChange(item, -1)}><Text>−</Text></Pressable>
                    <Text style={s.qtyNumber}>{item.quantity}</Text>
                    <Pressable style={s.qtyButton} onPress={() => onChange(item, 1)}><Text>＋</Text></Pressable>
                </View>
            ) : (
                <Text style={s.qty}>{item.quantity} {item.unit}</Text>
            )}
        </View>
    );
}

export function DocumentItemList({ items, onChange }: { items: DocumentItem[]; onChange?: Props['onChange'] }) {
    return <>{items.map((item, i) => <DocumentItemRow key={item.line_id ?? `${item.id}-${i}`} item={item} onChange={onChange} />)}</>;
}
