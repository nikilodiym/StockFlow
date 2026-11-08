/**
 * Secrets (JWT tokens, PIN) in the OS keystore via expo-secure-store.
 * Web has no keystore, so it falls back to AsyncStorage there.
 * Values written by older app versions to AsyncStorage are moved here on first read.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const useKeystore = Platform.OS !== 'web';

export const SecureStorage = {
    async get(key: string): Promise<string | null> {
        if (!useKeystore) return AsyncStorage.getItem(key);
        const value = await SecureStore.getItemAsync(key);
        if (value !== null) return value;
        const legacy = await AsyncStorage.getItem(key);
        if (legacy !== null) {
            await SecureStore.setItemAsync(key, legacy);
            await AsyncStorage.removeItem(key);
        }
        return legacy;
    },

    async set(key: string, value: string): Promise<void> {
        if (!useKeystore) return AsyncStorage.setItem(key, value);
        await SecureStore.setItemAsync(key, value);
    },

    async remove(key: string): Promise<void> {
        if (!useKeystore) return AsyncStorage.removeItem(key);
        await SecureStore.deleteItemAsync(key);
        await AsyncStorage.removeItem(key);
    },
};
