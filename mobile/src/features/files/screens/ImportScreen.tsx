import React, { useState } from 'react';
import { ScrollView, Text, TextInput } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { useAppStyles } from '../../../constants/styles';
import Button from '../../../components/ui/Button';
import Header from '../../../components/layout/Header';
import ScreenContainer from '../../../components/layout/ScreenContainer';
import { useDialog } from '../../../app/providers/DialogProvider';
import type { RootScreenProps } from '../../../app/navigation/types';
import { useProducts } from '../../products/hooks/useProducts';
import { CSV_HEADER, ProductService } from '../../products/services/ProductService';
import { usePermissions } from '../../../hooks/usePermissions';

/** Paste CSV with products: SKU, Barcode, Name, Unit, Stock. */
export default function ImportScreen({ navigation }: RootScreenProps<'Import'>) {
    const s = useAppStyles();

    const db = useSQLiteContext();
    const { reload } = useProducts();
    const { showDialog } = useDialog();
    const [text, setText] = useState('');
    const { requirePermission, reportError } = usePermissions();

    const importProducts = async () => {
        try {
            requirePermission('catalog.create');
            const count = await ProductService.importCsv(db, text);
            await reload();
            setText('');
            navigation.navigate('Tabs', { screen: 'Files' });
            showDialog('Імпорт завершено', `Додано або оновлено товарів: ${count}.`, undefined, 'success');
        } catch (error) {
            reportError(error, 'Помилка імпорту');
        }
    };

    return (
        <ScreenContainer>
            <Header back title="Імпорт товарів" />
            <ScrollView contentContainerStyle={s.pageBody}>
                <Text style={s.mutedCenter}>
                    Вставте CSV із колонками: SKU, Barcode, Name, Unit, Stock. Перший рядок — заголовки.
                </Text>
                <TextInput
                    style={s.csvInput}
                    multiline
                    textAlignVertical="top"
                    placeholder={`${CSV_HEADER}\nSKU-001,4820000000001,Назва товару,шт,12`}
                    value={text}
                    onChangeText={setText}
                />
                <Button label="Імпортувати товари" onPress={() => void importProducts()} />
            </ScrollView>
        </ScreenContainer>
    );
}
