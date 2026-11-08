/** Find a product by barcode / SKU / name and add it to the current document. */
import * as Haptics from 'expo-haptics';
import { useSQLiteContext } from 'expo-sqlite';
import { useDialog } from '../../../app/providers/DialogProvider';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { getErrorMessage } from '../../../utils/formatters';
import { parseQuantity } from '../../../utils/validators';
import { useProducts } from '../../products/hooks/useProducts';
import { ProductService } from '../../products/services/ProductService';
import type { Product } from '../../products/types/product.types';
import { useInventory } from './useInventory';

export type FindSource = 'scan' | 'search';

export function useAddProduct() {
    const db = useSQLiteContext();
    const { products } = useProducts();
    const { addItem, quantity } = useInventory();
    const { showDialog } = useDialog();
    const { vibrationOn } = useSettings();

    const vibrate = (run: () => Promise<void>) => { if (vibrationOn) void run().catch(() => undefined); };

    const add = async (product: Product): Promise<boolean> => {
        const amount = parseQuantity(quantity);
        if (amount === null) {
            showDialog('Перевірте кількість', 'Введіть коректну кількість товару.', undefined, 'error');
            return false;
        }
        try {
            await addItem(product, amount);
            vibrate(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
            return true;
        } catch (error) {
            showDialog('Не вдалося додати товар', getErrorMessage(error), undefined, 'error');
            return false;
        }
    };

    /** true when the product was found and added. */
    const find = async (term: string, source: FindSource): Promise<boolean> => {
        const value = term.trim();
        if (!value) {
            showDialog('Що шукаємо?', 'Введіть штрих-код або назву товару.', undefined, 'error');
            return false;
        }
        try {
            const product = await ProductService.find(db, products, value);
            if (!product) {
                if (source === 'scan') {
                    showDialog('Штрихкод не знайдено', `У каталозі немає товару з кодом ${value}. Додайте товар до каталогу й відскануйте його ще раз.`, undefined, 'error');
                } else {
                    showDialog('Товар не знайдено', 'Перевірте штрих-код або назву.', undefined, 'error');
                }
                return false;
            }
            const added = await add(product);
            if (added && source === 'scan') vibrate(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
            return added;
        } catch (error) {
            showDialog('Помилка пошуку', getErrorMessage(error), undefined, 'error');
            return false;
        }
    };

    return { add, find };
}
