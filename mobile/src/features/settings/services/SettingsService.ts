/** Loading and saving device preferences. */
import { DEFAULT_SYNC_INTERVAL, DEFAULT_WAREHOUSE, STORAGE_KEYS } from '../../../constants/config';
import { Storage } from '../../../services/storage/Storage';
import type { Preferences } from '../types/settings.types';

export const SettingsService = {
    async load(): Promise<Preferences> {
        const [serverUrl, autoSync, syncInterval, warehouse, soundOn, vibrationOn] = await Promise.all([
            Storage.get(STORAGE_KEYS.serverUrl),
            Storage.get(STORAGE_KEYS.autoSync),
            Storage.get(STORAGE_KEYS.syncInterval),
            Storage.get(STORAGE_KEYS.warehouse),
            Storage.get(STORAGE_KEYS.soundOn),
            Storage.get(STORAGE_KEYS.vibrationOn),
        ]);
        return {
            serverUrl,
            soundOn: soundOn !== 'false',
            vibrationOn: vibrationOn !== 'false',
            autoSync: autoSync == null ? true : autoSync === 'true',
            syncInterval: syncInterval || DEFAULT_SYNC_INTERVAL,
            warehouse: warehouse || DEFAULT_WAREHOUSE,
        };
    },

    saveSound: (value: boolean) => Storage.set(STORAGE_KEYS.soundOn, String(value)),
    saveVibration: (value: boolean) => Storage.set(STORAGE_KEYS.vibrationOn, String(value)),
    saveServerUrl: (url: string) => Storage.set(STORAGE_KEYS.serverUrl, url),
    saveAutoSync: (value: boolean) => Storage.set(STORAGE_KEYS.autoSync, String(value)),
    saveSyncInterval: (value: string) => Storage.set(STORAGE_KEYS.syncInterval, value),
    saveWarehouse: (value: string) => Storage.set(STORAGE_KEYS.warehouse, value),
};
