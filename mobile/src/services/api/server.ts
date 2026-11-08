/**
 * Where is the API? The app must work on any emulator and on a physical phone,
 * so the address is discovered instead of being hardcoded.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { API_PORT, ENV_API_URL, TIMEOUTS } from '../../constants/config';
import { fetchWithTimeout, joinUrl } from './client';
import { ENDPOINTS } from './endpoints';

export const apiUrl = (host: string, port: string = API_PORT): string => `http://${host}:${port}/api`;

// Host of the Metro bundler the app was loaded from = the computer's LAN IP.
// Reachable from any emulator and from a phone in the same Wi-Fi.
const metroHost: string | null = (() => {
    const uri = Constants.expoConfig?.hostUri
        ?? (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost
        ?? '';
    return uri.split(':')[0] || null;
})();

// Android emulators reach the computer through 10.0.2.2; iOS simulator/web through localhost.
const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

/** Default address: fixed one from .env (builds) or the Metro host (development). */
export const DEFAULT_API_URL = ENV_API_URL || apiUrl(metroHost ?? fallbackHost);

/** Addresses to try, best first: saved, .env, Metro host, emulator alias, localhost. */
export function serverCandidates(saved?: string | null): string[] {
    const list = [
        saved,
        ENV_API_URL || null,
        metroHost ? apiUrl(metroHost) : null,
        Platform.OS === 'android' ? apiUrl('10.0.2.2') : null,
        apiUrl('localhost'),
    ];
    return [...new Set(list.filter((url): url is string => !!url).map(url => url.replace(/\/$/, '')))];
}

/** First candidate whose /health/ answers 200, or null. */
export async function findServer(candidates: string[], ms: number = TIMEOUTS.discovery): Promise<string | null> {
    for (const url of candidates) {
        try {
            const response = await fetchWithTimeout(joinUrl(url, ENDPOINTS.health), {}, ms);
            if (response.ok) return url;
        } catch {
            // try the next address
        }
    }
    return null;
}

/** Splits http://host:port/api into host and port for the Settings form. */
export function parseServerUrl(url: string): { host: string; port: string } {
    const address = url.replace(/^https?:\/\//i, '').split('/')[0];
    const separator = address.lastIndexOf(':');
    return separator < 0
        ? { host: address, port: API_PORT }
        : { host: address.slice(0, separator), port: address.slice(separator + 1) };
}
