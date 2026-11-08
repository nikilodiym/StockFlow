/** Non-secret preferences (server address, warehouse, sync settings) in AsyncStorage. */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const Storage = {
    get: (key: string): Promise<string | null> => AsyncStorage.getItem(key),
    set: (key: string, value: string): Promise<void> => AsyncStorage.setItem(key, value),
    remove: (key: string): Promise<void> => AsyncStorage.removeItem(key),

    async getJson<T>(key: string): Promise<T | null> {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return null;
        try {
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    },

    setJson: (key: string, value: unknown): Promise<void> => AsyncStorage.setItem(key, JSON.stringify(value)),
};
