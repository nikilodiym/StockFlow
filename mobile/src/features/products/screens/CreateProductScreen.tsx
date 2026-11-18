import { useResponsiveStyles } from '../../../hooks/useResponsiveStyles';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import Header from '../../../components/layout/Header';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { useDialog } from '../../../app/providers/DialogProvider';
import { usePermissions } from '../../../hooks/usePermissions';
import type { RootScreenProps } from '../../../app/navigation/types';
import { useProducts } from '../hooks/useProducts';
import { ProductCreationService } from '../services/ProductCreationService';
import BarcodeCaptureSheet from '../components/BarcodeCaptureSheet';

export default function CreateProductScreen({ navigation, route }: RootScreenProps<'CreateProduct'>) {
    const s = useResponsiveStyles(baseStyles);

    const db = useSQLiteContext();
    const { token, refreshToken } = useAuth();
    const { serverUrl } = useSettings();
    const { reload } = useProducts();
    const { showDialog } = useDialog();
    const { requirePermission, reportError } = usePermissions();
    const [name, setName] = useState(''),
        [sku, setSku] = useState(''),
        [barcode, setBarcode] = useState(route.params?.barcode ?? ''),
        [unit, setUnit] = useState('шт');
    const [capture, setCapture] = useState(false),
        [saving, setSaving] = useState(false);
    const save = async () => {
        if (saving) return;
        try {
            requirePermission('catalog.create');
            setSaving(true);
            const access = (await refreshToken()) ?? token;
            const product = await ProductCreationService.create(db, serverUrl, access, { name, sku, barcode, unit });
            await reload();
            showDialog(
                'Товар додано',
                `«${product.name}» збережено в каталозі. Тепер його можна знайти за назвою, SKU або штрихкодом.`,
                [
                    {
                        label: 'До каталогу',
                        tone: 'primary',
                        onPress: () => navigation.popTo('Search', { selectedProductId: product.id }),
                    },
                ],
                'success',
            );
        } catch (error) {
            reportError(error, 'Не вдалося створити товар');
        } finally {
            setSaving(false);
        }
    };
    return (
        <ScreenContainer>
            <Header back title="Новий товар" />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
                    <View style={s.card}>
                        <Text style={s.title}>Картка нового товару</Text>
                        <Text style={s.help}>Додайте товар до каталогу вручну або зчитайте штрихкод з упаковки.</Text>
                        <Input
                            label="Назва товару"
                            placeholder="Наприклад, фарба акрилова біла 2.5 л"
                            value={name}
                            onChangeText={setName}
                        />
                        <Input
                            label="SKU"
                            placeholder="Наприклад, PNT-0103"
                            value={sku}
                            onChangeText={setSku}
                            autoCapitalize="characters"
                            autoCorrect={false}
                        />
                        <Input
                            label="Штрихкод"
                            placeholder="Введіть або відскануйте код"
                            value={barcode}
                            onChangeText={setBarcode}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        <Button
                            variant="secondary"
                            icon="scan"
                            label="Сканувати штрихкод товару"
                            onPress={() => {
                                try {
                                    requirePermission('catalog.create');
                                    setCapture(true);
                                } catch (e) {
                                    reportError(e);
                                }
                            }}
                        />
                        <Text style={s.label}>Одиниця виміру</Text>
                        <View style={s.units}>
                            {['шт', 'кг', 'упак', 'л'].map((v) => (
                                <Pressable
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: unit === v }}
                                    key={v}
                                    onPress={() => setUnit(v)}
                                    style={[s.unit, unit === v && s.active]}
                                >
                                    <Text style={[s.unitText, unit === v && s.activeText]}>{v}</Text>
                                </Pressable>
                            ))}
                        </View>
                        <Text style={s.help}>
                            Залишок нового товару — 0. Щоб оприбуткувати поставку, додайте його до документа «Прихід».
                        </Text>
                    </View>
                    <Button
                        label={saving ? 'Збереження…' : 'Зберегти товар у каталозі'}
                        icon="plus"
                        disabled={saving}
                        onPress={() => void save()}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
            <BarcodeCaptureSheet visible={capture} onClose={() => setCapture(false)} onCapture={setBarcode} />
        </ScreenContainer>
    );
}
const baseStyles = StyleSheet.create({
    body: { padding: 16, paddingBottom: 32 },
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
    title: { fontSize: 20, fontWeight: '600', color: '#182021' },
    help: { fontSize: 14, lineHeight: 20, color: '#606876', marginTop: 14 },
    label: { fontSize: 14, color: '#606876', marginTop: 20, marginBottom: 8 },
    units: { flexDirection: 'row', backgroundColor: '#EEE', borderRadius: 12, padding: 5 },
    unit: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
    active: { backgroundColor: '#12715B' },
    unitText: { fontSize: 16, color: '#12715B' },
    activeText: { color: '#fff', fontWeight: '600' },
});
