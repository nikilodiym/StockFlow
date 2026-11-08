/** Bottom sheet to choose the warehouse (login, home, profile). */
import { useDialog } from '../../../app/providers/DialogProvider';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { WAREHOUSES } from '../../../constants/config';

export function useWarehousePicker() {
    const { showDialog } = useDialog();
    const { chooseWarehouse } = useSettings();

    return () => showDialog('Оберіть склад', 'Виберіть філію для поточного документа.', [
        ...WAREHOUSES.map(w => ({ label: w.name, tone: 'neutral' as const, onPress: () => chooseWarehouse(w.name) })),
        { label: 'Скасувати', tone: 'primary' },
    ], 'sheet');
}
