import { Platform } from 'react-native';

// Android emulators reach the host computer through 10.0.2.2. Physical
// devices can use their computer's LAN address from Settings.
export const API = Platform.OS === 'android'
    ? 'http://10.0.2.2:8000/api'
    : 'http://localhost:8000/api';

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

