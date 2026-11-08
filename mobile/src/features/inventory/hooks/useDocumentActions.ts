/** Save / post / delete with confirmations, navigation and a sync attempt afterwards. */
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../app/providers/AuthProvider';
import { useDialog } from '../../../app/providers/DialogProvider';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { useSync } from '../../../app/providers/SyncProvider';
import { getErrorMessage } from '../../../utils/formatters';
import { useInventory } from './useInventory';

/** docId — a saved document; undefined — the current one. */
export function useDocumentActions(docId?: string) {
    const navigation = useNavigation();
    const { showDialog } = useDialog();
    const { online, warehouse } = useSettings();
    const { token } = useAuth();
    const { sync } = useSync();
    const { items, saveCurrent, postSaved, deleteDocument, clearCurrent } = useInventory();

    const syncIfOnline = () => { if (online && token) void sync(); };

    const saveCurrentDocument = async (status: 'draft' | 'posted' = 'draft') => {
        if (items.length === 0) {
            showDialog('Порожній документ', 'Спочатку додайте хоча б один товар.', undefined, 'error');
            return;
        }
        try {
            await saveCurrent(status, warehouse);
            navigation.navigate('Tabs', { screen: 'Home' });
            showDialog(
                status === 'posted' ? 'Документ проведено' : 'Збережено офлайн',
                status === 'posted' ? 'Документ збережено та додано до черги синхронізації.' : 'Документ збережено на пристрої. Його можна синхронізувати пізніше.',
                undefined, 'success',
            );
            syncIfOnline();
        } catch (error) {
            showDialog('Помилка збереження', getErrorMessage(error), undefined, 'error');
        }
    };

    const post = async () => {
        if (!docId) return saveCurrentDocument('posted');
        await postSaved(docId);
        syncIfOnline();
        showDialog('Документ проведено', 'Зміни збережено локально та поставлено в чергу синхронізації.', undefined, 'success');
    };

    const remove = () => {
        if (!docId) {
            showDialog('Очистити поточний документ?', 'Усі його позиції буде видалено.', [
                { label: 'Залишити документ', tone: 'neutral' },
                { label: 'Очистити', tone: 'danger', onPress: async () => { await clearCurrent(); navigation.navigate('Tabs', { screen: 'Home' }); } },
            ], 'confirm');
            return;
        }
        showDialog('Видалити документ?', 'Документ і його позиції буде видалено. Цю дію не можна скасувати.', [
            { label: 'Залишити', tone: 'neutral' },
            { label: 'Видалити документ', tone: 'danger', onPress: async () => { await deleteDocument(docId); navigation.navigate('Tabs', { screen: 'Documents' }); } },
        ], 'confirm');
    };

    return { saveCurrentDocument, post, remove };
}
