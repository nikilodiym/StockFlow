/** Server address form on the Settings screen: validate, save, check /health/. */
import { useDialog } from '../../../app/providers/DialogProvider';
import { useSettings } from '../../../app/providers/SettingsProvider';
import { TIMEOUTS } from '../../../constants/config';
import { fetchWithTimeout, joinUrl, readJson } from '../../../services/api/client';
import { ENDPOINTS } from '../../../services/api/endpoints';
import { apiUrl } from '../../../services/api/server';
import { getErrorMessage } from '../../../utils/formatters';
import { isValidPort } from '../../../utils/validators';

export function useServerSettings() {
    const { serverHost, serverPort, applyServerUrl, setOnline } = useSettings();
    const { showDialog } = useDialog();

    const checkConnection = async () => {
        const host = serverHost.trim();
        const port = serverPort.trim();
        if (!host || !isValidPort(port)) {
            showDialog('Перевірте адресу сервера', 'Вкажіть коректну IP-адресу та порт.', undefined, 'error');
            return;
        }
        const url = apiUrl(host, port);
        await applyServerUrl(url);
        try {
            const response = await fetchWithTimeout(joinUrl(url, ENDPOINTS.health), {}, TIMEOUTS.health);
            const body = await readJson<{ detail?: string }>(response);
            setOnline(response.ok);
            showDialog(
                response.ok ? 'З’єднання встановлено' : 'Сервер недоступний',
                response.ok ? 'WareGo підключено до сервера.' : body.detail || `Сервер повернув ${response.status}.`,
                undefined,
                response.ok ? 'success' : 'error',
            );
        } catch (error) {
            setOnline(false);
            showDialog('Немає з’єднання', getErrorMessage(error), undefined, 'error');
        }
    };

    return { checkConnection };
}
