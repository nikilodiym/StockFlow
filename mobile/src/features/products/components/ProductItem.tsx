import React from 'react';
import { Pressable, Text, View } from 'react-native';
import s from '../../../constants/styles';
import { colors } from '../../../constants/colors';
import Icon from '../../../components/ui/Icon';
import type { Product } from '../types/product.types';

/** One product in the quick-pick list; pressing adds it to the document. */
export default function ProductItem({ product, onPress }: { product: Product; onPress: (product: Product) => void }) {
    return (
        <Pressable onPress={() => onPress(product)} style={s.productRow}>
            <View style={s.productBadge}><Icon name="file" size={17} color={colors.primary} /></View>
            <View style={s.productInfo}>
                <Text style={s.productName}>{product.name}</Text>
                <Text style={s.productCode}>{product.sku} · {product.barcode}</Text>
            </View>
            <Text style={s.linkText}>＋</Text>
        </Pressable>
    );
}
