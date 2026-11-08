import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import s from '../../../constants/styles';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Header from '../../../components/layout/Header';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import type { RootScreenProps } from '../../../app/navigation/types';
import { useAddProduct } from '../../inventory/hooks/useAddProduct';
import ProductList from '../components/ProductList';
import { useProducts } from '../hooks/useProducts';
import { filterProducts } from '../services/ProductService';
import type { Product } from '../types/product.types';

/** Manual search: by SKU/name (quick pick) or by barcode. */
export default function SearchScreen({ navigation }: RootScreenProps<'Search'>) {
    const { products } = useProducts();
    const { add, find } = useAddProduct();
    const [query, setQuery] = useState('');
    const [barcode, setBarcode] = useState('');
    const filtered = filterProducts(products, query);

    const findByBarcode = async () => {
        if (await find(barcode, 'search')) setBarcode('');
    };
    const pick = (product: Product) => {
        void add(product);
        navigation.navigate('DocumentDetail', {});
    };

    return (
        <ScreenContainer>
            <Header back title="Ручне введення" />
            <ScrollView contentContainerStyle={s.pageBody} keyboardShouldPersistTaps="handled">
                <Input label="ПОШУК ЗА SKU АБО НАЗВОЮ" placeholder="Наприклад, фарба" value={query} onChangeText={setQuery} autoFocus />
                <Input label="ШТРИХ-КОД" placeholder="13 цифр" keyboardType="number-pad" value={barcode} onChangeText={setBarcode} />
                <Button variant="scan" label="Знайти за штрихкодом" onPress={() => void findByBarcode()} />
                <View style={s.sectionHeading}>
                    <Text style={s.sectionLabel}>ШВИДКИЙ ВИБІР</Text>
                    <Text style={s.linkText}>{filtered.length} товарів</Text>
                </View>
                <ProductList products={filtered} onSelect={pick} />
            </ScrollView>
        </ScreenContainer>
    );
}
