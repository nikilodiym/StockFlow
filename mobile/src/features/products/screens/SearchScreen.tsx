import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import Header, { HeaderIconButton } from '../../../components/layout/Header';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import Icon from '../../../components/ui/Icon';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { usePermissions } from '../../../hooks/usePermissions';
import type { RootScreenProps } from '../../../app/navigation/types';
import { useInventory } from '../../inventory/hooks/useInventory';
import { useAddProduct } from '../../inventory/hooks/useAddProduct';
import { useScanDestination } from '../../inventory/hooks/useScanDestination';
import { documentLabel } from '../../inventory/services/DocumentService';
import ProductItem from '../components/ProductItem';
import ProductSelection from '../components/ProductSelection';
import { useProducts } from '../hooks/useProducts';
import { filterProducts, ProductService } from '../services/ProductService';
import type { Product } from '../types/product.types';

export default function SearchScreen({ navigation, route }: RootScreenProps<'Search'>) {
    const db = useSQLiteContext();
    const { products } = useProducts();
    const { add } = useAddProduct();
    const { warehouse } = useSettings();
    const { scanDocumentId, savedDocs } = useInventory();
    const { requirePermission, reportError } = usePermissions();
    const destination = useScanDestination(() => {});
    const [query, setQuery] = useState(''),
        [barcode, setBarcode] = useState(''),
        [barcodeError, setBarcodeError] = useState(false);
    const [selected, setSelected] = useState<Product | null>(null),
        [quantity, setQuantity] = useState('1'),
        [unit, setUnit] = useState('шт'),
        [adding, setAdding] = useState(false);
    const searching = !!query.trim();
    const filtered = filterProducts(products, query);
    const doc = savedDocs.find((d) => d.id === scanDocumentId);
    const pick = (product: Product) => {
        setSelected(product);
        setQuantity('1');
        setUnit(product.unit);
    };
    useEffect(() => {
        const product = products.find((p) => p.id === route.params?.selectedProductId);
        if (product) {
            pick(product);
            navigation.setParams({ selectedProductId: undefined });
        }
    }, [route.params?.selectedProductId, products, navigation]);
    const lookup = async () => {
        if (!barcode.trim()) {
            setBarcodeError(false);
            return;
        }
        try {
            const product = await ProductService.findByBarcode(db, products, barcode.trim());
            setBarcodeError(!product);
            if (product) pick(product);
        } catch (e) {
            reportError(e, 'Помилка пошуку');
        }
    };
    const create = () => {
        try {
            requirePermission('catalog.create');
            navigation.navigate('CreateProduct', { barcode: barcode.trim() });
        } catch (e) {
            reportError(e);
        }
    };
    const addSelected = async () => {
        if (!selected || adding) return;
        setAdding(true);
        try {
            if (await add(selected, quantity, unit))
                navigation.navigate('DocumentDetail', { docId: scanDocumentId ?? undefined });
        } finally {
            setAdding(false);
        }
    };
    return (
        <ScreenContainer>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <Header
                    back
                    title=""
                    right={
                        <HeaderIconButton label="Створити товар" onPress={create}>
                            <Icon name="plus" size={22} />
                        </HeaderIconButton>
                    }
                />
                <ScrollView style={{ flex: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
                    <View style={s.heading}>
                        <Text style={s.title}>Ручне введення</Text>
                        <Pressable onPress={destination.open}>
                            <Text style={doc ? s.document : s.choose}>
                                {doc ? documentLabel(doc) : 'Обрати документ'}
                            </Text>
                        </Pressable>
                    </View>
                    <Text style={s.label}>Пошук за SKU або назвою</Text>
                    <TextInput
                        accessibilityLabel="Пошук за SKU або назвою"
                        style={s.input}
                        placeholder="Наприклад, PNT або фарба"
                        placeholderTextColor="#667085"
                        value={query}
                        onChangeText={(v) => {
                            setQuery(v);
                            setSelected(null);
                        }}
                    />
                    <Text style={s.label}>Штрих-код</Text>
                    <View>
                        <TextInput
                            accessibilityLabel="Штрих-код"
                            style={[s.input, barcodeError && s.invalid]}
                            placeholder="13 цифр"
                            placeholderTextColor="#667085"
                            keyboardType="default"
                            autoCapitalize="none"
                            autoCorrect={false}
                            value={barcode}
                            onChangeText={(v) => {
                                setBarcode(v);
                                setBarcodeError(false);
                            }}
                            onSubmitEditing={() => void lookup()}
                            returnKeyType="search"
                        />
                        <Pressable
                            accessibilityLabel="Знайти за штрихкодом"
                            style={s.lookup}
                            onPress={() => void lookup()}
                        >
                            <Icon name="search" size={20} color="#667085" />
                        </Pressable>
                    </View>
                    {barcodeError && (
                        <View>
                            <Text style={s.error}>Штрих-код не знайдено в базі</Text>
                            <Pressable onPress={create}>
                                <Text style={s.createLink}>＋ Створити товар із цим штрихкодом</Text>
                            </Pressable>
                        </View>
                    )}
                    <View style={s.results}>
                        <Text style={s.resultsTitle}>{searching ? 'Результати пошуку' : 'Швидкий вибір'}</Text>
                        {searching && (
                            <Text style={s.count}>
                                {filtered.length}{' '}
                                {filtered.length === 1
                                    ? 'товар'
                                    : filtered.length >= 2 && filtered.length <= 4
                                      ? 'товари'
                                      : 'товарів'}
                            </Text>
                        )}
                    </View>
                    {filtered.map((p) => (
                        <ProductItem key={p.id} product={p} selected={selected?.id === p.id} onPress={pick} />
                    ))}
                    {!filtered.length && (
                        <View style={s.empty}>
                            <Text style={s.emptyText}>Нічого не знайдено за запитом «{query}»</Text>
                            <Pressable onPress={create}>
                                <Text style={s.createLink}>＋ Додати новий товар</Text>
                            </Pressable>
                        </View>
                    )}
                </ScrollView>
                {selected && (
                    <ProductSelection
                        product={selected}
                        warehouse={warehouse}
                        quantity={quantity}
                        unit={unit}
                        busy={adding}
                        onQuantity={setQuantity}
                        onUnit={setUnit}
                        onAdd={() => void addSelected()}
                    />
                )}
            </KeyboardAvoidingView>
            {destination.sheets}
        </ScreenContainer>
    );
}
const s = StyleSheet.create({
    body: { paddingHorizontal: 16, paddingBottom: 20 },
    heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 12 },
    title: { fontSize: 22, fontWeight: '500', color: '#182021' },
    document: { fontSize: 22, fontWeight: '500', color: '#182021' },
    choose: { fontSize: 13, fontWeight: '500', color: '#12715B' },
    label: { fontSize: 14, color: '#667085', marginTop: 14, marginBottom: 8 },
    input: {
        height: 44,
        borderWidth: 1,
        borderColor: '#E8EAE9',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingRight: 42,
        fontSize: 17,
        color: '#111',
    },
    invalid: { borderColor: '#E54D4D' },
    lookup: { position: 'absolute', right: 12, top: 11 },
    results: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 16 },
    resultsTitle: { fontSize: 16, fontWeight: '500', color: '#111' },
    count: { fontSize: 16, color: '#087F6A', fontWeight: '500' },
    error: { fontSize: 12, color: '#D94C4C', marginTop: 6 },
    createLink: { fontSize: 14, color: '#12715B', marginTop: 12 },
    empty: { paddingTop: 92, alignItems: 'center' },
    emptyText: { fontSize: 12, color: '#667085' },
});
