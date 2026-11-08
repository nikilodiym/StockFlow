import React from 'react';
import { Text, View } from 'react-native';
import s from '../../../constants/styles';
import { colors } from '../../../constants/colors';
import Icon from '../../../components/ui/Icon';
import type { Product } from '../types/product.types';
import ProductItem from './ProductItem';

/** Products list with an empty state. */
export default function ProductList({ products, onSelect }: { products: Product[]; onSelect: (product: Product) => void }) {
    if (products.length === 0) {
        return (
            <View style={s.emptyState}>
                <Icon name="search" size={28} color={colors.primary} />
                <Text style={s.emptyTitle}>Нічого не знайдено</Text>
                <Text style={s.mutedCenter}>Перевірте назву, SKU або штрихкод</Text>
            </View>
        );
    }
    return <>{products.map(product => <ProductItem key={product.id} product={product} onPress={onSelect} />)}</>;
}
