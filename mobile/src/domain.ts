import { Platform } from 'react-native';
import Constants from 'expo-constants';

export const API_PORT = '8000';
export const apiUrl = (host: string, port: string = API_PORT): string => `http://${host}:${port}/api`;

// Host of the Metro bundler the app was loaded from = the computer's LAN IP.
// It is reachable from any emulator (Pixel 6, Pixel 9 …) and from a physical
// phone in the same Wi-Fi, so it is the best default for the API too.
const metroHost: string | null = (() => {
    const uri = Constants.expoConfig?.hostUri
        ?? (Constants as unknown as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost
        ?? '';
    const host = uri.split(':')[0];
    return host || null;
})();

// Android emulators reach the computer through 10.0.2.2; iOS simulator/web through localhost.
const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const API = apiUrl(metroHost ?? fallbackHost);

/** Addresses to try, best first: the saved one, Metro host, emulator alias, localhost. */
export function serverCandidates(saved?: string | null): string[] {
    const list = [
        saved,
        metroHost ? apiUrl(metroHost) : null,
        Platform.OS === 'android' ? apiUrl('10.0.2.2') : null,
        apiUrl('localhost'),
    ];
    return [...new Set(list.filter((url): url is string => !!url).map(url => url.replace(/\/$/, '')))];
}

/** fetch that gives up after `ms` instead of hanging (RN fetch has no timeout). */
export async function fetchWithTimeout(url: string, options: RequestInit = {}, ms = 8000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
        if (controller.signal.aborted) {
            throw new Error(`Сервер не відповів за ${Math.round(ms / 1000)} с (${url.replace(/\/[^/]*\/?$/, '')})`);
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

/** First candidate whose /health/ answers 200, or null. */
export async function findServer(candidates: string[], ms = 3000): Promise<string | null> {
    for (const url of candidates) {
        try {
            const response = await fetchWithTimeout(`${url}/health/`, {}, ms);
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

export type Screen = 'home' | 'scan' | 'search' | 'docs' | 'settings' | 'profile' | 'files' | 'detail' | 'import' | 'notifications' | 'conflict';
export type DocumentType = 'receipt' | 'writeoff' | 'inventory' | 'transfer';

export type Product = {
    id: number;
    sku: string;
    barcode: string;
    name: string;
    unit: string;
    stock: number;
};

export const testBarcode = '4820000000017';
export type DocumentItem = Product & {
    quantity: number;
    line_id?: number;
};

export type OutboxRow = {
    id: string;
    payload: string;
    created_at: string;
};

export type UserData = {
    name?: string;
    username?: string;
    email?: string;
};

export type LoginResponse = {
    access?: string;
    refresh?: string;
    tokens?: {
        access?: string;
        refresh?: string;
    };
    user?: UserData;
    profile?: UserData;
    detail?: string;
    message?: string;
    error?: string;
};

export const localSeed: [string, string, string, string, number][] = [
    ['DRK-001', '4820000000017', 'Вода мінеральна 1.5 л', 'шт', 128],
    ['DRK-002', '4820000000012', 'Сік апельсиновий 1 л', 'шт', 42],
    ['FOO-001', '4820000000013', 'Кава зернова 1 кг', 'упак', 18],
    ['FOO-002', '4820000000014', 'Рис довгозернистий 1 кг', 'упак', 7],
    ['HOM-001', '4820000000015', 'Рушники паперові 2 шт', 'упак', 34],
];

export const documentTabs: [DocumentType, string][] = [
    ['receipt', 'Прихід'],
    ['writeoff', 'Списання'],
    ['inventory', 'Інвентаризація'],
    ['transfer', 'Переміщення'],
];

export type DialogAction = { label: string; description?: string; icon?: 'download' | 'trash' | 'file' | 'refresh'; onPress?: () => void | Promise<void>; tone?: 'primary' | 'danger' | 'neutral' };
export type AppDialog = { title: string; message?: string; kind?: 'info' | 'success' | 'error' | 'confirm' | 'sheet' | 'newdoc' | 'input'; actions: DialogAction[]; value?: string; placeholder?: string; onChangeText?: (value: string) => void };

export const uuid = (): string =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });

export function getErrorMessage(error: unknown): string {
    return error instanceof Error
        ? error.message
        : 'Сталася невідома помилка.';
}

