/** Where the session lives: tokens and PIN in SecureStorage, profile in AsyncStorage. */
import { SECURE_KEYS, STORAGE_KEYS } from '../../../constants/config';
import { SecureStorage } from '../../../services/storage/SecureStorage';
import { Storage } from '../../../services/storage/Storage';
import type { Session, UserData } from '../types/auth.types';

export const AuthRepository = {
    async loadSession(): Promise<Session | null> {
        const [token, refresh, user] = await Promise.all([
            SecureStorage.get(SECURE_KEYS.token),
            SecureStorage.get(SECURE_KEYS.refresh),
            Storage.getJson<UserData>(STORAGE_KEYS.user),
        ]);
        return token ? { token, refresh, user } : null;
    },

    async saveSession({ token, refresh, user }: Session): Promise<void> {
        await SecureStorage.set(SECURE_KEYS.token, token);
        if (refresh) await SecureStorage.set(SECURE_KEYS.refresh, refresh);
        else await SecureStorage.remove(SECURE_KEYS.refresh);
        if (user) await Storage.setJson(STORAGE_KEYS.user, user);
    },

    async clearSession(): Promise<void> {
        await Promise.all([
            SecureStorage.remove(SECURE_KEYS.token),
            SecureStorage.remove(SECURE_KEYS.refresh),
            Storage.remove(STORAGE_KEYS.user),
        ]);
    },

    loadPin: () => SecureStorage.get(SECURE_KEYS.pin),
    savePin: (pin: string) => SecureStorage.set(SECURE_KEYS.pin, pin),
};
