import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Product } from '../types/product.types';
export default function ProductItem({
    product,
    onPress,
    selected = false,
}: {
    product: Product;
    onPress: (product: Product) => void;
    selected?: boolean;
}) {
    const badge = product.sku.split('-')[0].slice(0, 3).toUpperCase() || 'SKU';
    return (
        <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onPress(product)}
            style={[s.row, selected && s.selected]}
        >
            <View style={[s.badge, selected && { backgroundColor: '#fff' }]}>
                <Text style={s.badgeText}>{badge}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={s.name}>{product.name}</Text>
                <Text style={s.code}>
                    {product.sku} · {product.barcode}
                </Text>
            </View>
            {selected && (
                <View style={s.radio}>
                    <View style={s.dot} />
                </View>
            )}
        </Pressable>
    );
}
const s = StyleSheet.create({
    row: {
        minHeight: 68,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E9EBEA',
        backgroundColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8,
    },
    selected: { borderColor: '#147D68', backgroundColor: '#D8F2E4' },
    badge: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#D8F2E4',
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: { fontSize: 14, fontWeight: '500', color: '#12715B' },
    name: { fontSize: 16, fontWeight: '500', color: '#0E1112' },
    code: { fontSize: 12, color: '#667085', marginTop: 5 },
    radio: {
        width: 25,
        height: 25,
        borderRadius: 13,
        borderWidth: 2,
        borderColor: '#12715B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dot: { width: 15, height: 15, borderRadius: 8, backgroundColor: '#12715B' },
});
