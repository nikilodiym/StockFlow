import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../../components/ui/Icon';
import type { Product } from '../types/product.types';

type Props = {
    product: Product;
    warehouse: string;
    quantity: string;
    unit: string;
    busy: boolean;
    onQuantity: (value: string) => void;
    onUnit: (value: string) => void;
    onAdd: () => void;
};
export default function ProductSelection({
    product,
    warehouse,
    quantity,
    unit,
    busy,
    onQuantity,
    onUnit,
    onAdd,
}: Props) {
    const insets = useSafeAreaInsets();
    const available = [product.unit, ...(product.units ?? []).filter((u) => u.factor > 0).map((u) => u.name)];
    const options = [...new Set([...['шт', 'кг', 'упак'], ...available])];
    const change = (delta: number) =>
        onQuantity(String(Math.max(1, (Number(quantity.replace(',', '.')) || 1) + delta)));
    return (
        <View style={[s.sheet, { paddingBottom: Math.max(16, insets.bottom) }]}>
            <View style={s.heading}>
                <Text style={s.name}>{product.name}</Text>
                <Text style={s.stock}>
                    {warehouse.replace(' Київ', '').replace(' Львів', '')}: {product.stock} {product.unit}
                </Text>
            </View>
            <Text style={s.code}>
                {product.sku} · {product.barcode}
            </Text>
            <Text style={s.label}>Одиниця виміру</Text>
            <View style={s.units}>
                {options.map((v) => (
                    <Pressable
                        key={v}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: unit === v, disabled: !available.includes(v) }}
                        disabled={!available.includes(v)}
                        style={[s.unit, unit === v && s.activeUnit, !available.includes(v) && { opacity: 0.35 }]}
                        onPress={() => onUnit(v)}
                    >
                        <Text style={[s.unitText, unit === v && { color: '#fff', fontWeight: '600' }]}>{v}</Text>
                    </Pressable>
                ))}
            </View>
            <Text style={[s.label, { marginTop: 8 }]}>Кількість у документі</Text>
            <View style={s.quantity}>
                <Pressable accessibilityLabel="Зменшити кількість" style={s.minus} onPress={() => change(-1)}>
                    <Icon name="minus" size={22} />
                </Pressable>
                <TextInput
                    accessibilityLabel="Кількість у документі"
                    style={s.quantityValue}
                    keyboardType="decimal-pad"
                    value={quantity}
                    onChangeText={onQuantity}
                />
                <Pressable accessibilityLabel="Збільшити кількість" style={s.plus} onPress={() => change(1)}>
                    <Icon name="plus" size={22} color="#12715B" />
                </Pressable>
            </View>
            <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={onAdd}
                style={[s.add, busy && { opacity: 0.5 }]}
            >
                <Icon name="plus" size={22} color="#fff" />
                <Text style={s.addText}>{busy ? 'Додавання…' : 'Додати в документ'}</Text>
            </Pressable>
        </View>
    );
}
const s = StyleSheet.create({
    sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 16, paddingTop: 24 },
    heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    name: { fontSize: 16, fontWeight: '500', color: '#101214', flex: 1 },
    stock: { fontSize: 15, color: '#667085', flexShrink: 1, textAlign: 'right' },
    code: { fontSize: 12, color: '#667085', marginTop: 6 },
    label: { fontSize: 12, color: '#667085', marginTop: 24, marginBottom: 8 },
    units: { flexDirection: 'row', padding: 5, borderRadius: 12, backgroundColor: '#EEE' },
    unit: { flex: 1, minHeight: 42, justifyContent: 'center', alignItems: 'center', borderRadius: 10 },
    activeUnit: { backgroundColor: '#12715B' },
    unitText: { fontSize: 16, color: '#087B68' },
    quantity: {
        height: 56,
        borderRadius: 12,
        borderColor: '#E6E8E7',
        borderWidth: 1,
        padding: 5,
        flexDirection: 'row',
        alignItems: 'center',
    },
    minus: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: '#F2F4F3',
        alignItems: 'center',
        justifyContent: 'center',
    },
    plus: {
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: '#D8F2E4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    quantityValue: { flex: 1, fontSize: 20, fontWeight: '600', color: '#182021', textAlign: 'center', padding: 0 },
    add: {
        marginTop: 24,
        minHeight: 44,
        borderRadius: 12,
        backgroundColor: '#12715B',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 10,
    },
    addText: { fontSize: 17, fontWeight: '600', color: '#fff' },
});
