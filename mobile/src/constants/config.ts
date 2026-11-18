/** App-wide constants and settings. */

export const API_PORT = '8000';

/**
 * Fixed API address for builds (e.g. https://api.example.com/api), from mobile/.env.
 * When empty, the app finds the server automatically (Metro host, 10.0.2.2, localhost).
 */
export const ENV_API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export const TIMEOUTS = {
    health: 5000,
    discovery: 3000,
    login: 10000,
    sync: 20000,
    default: 8000,
} as const;

/** Server health is re-checked this often (ms). */
export const HEALTH_POLL_MS = 20000;

export const DATABASE_NAME = 'stockflow.db';

export const WAREHOUSES = [
    { id: 1, name: 'Склад №1 Київ' },
    { id: 2, name: 'Склад №2 Львів' },
] as const;
export const DEFAULT_WAREHOUSE = WAREHOUSES[0].name;

export const SYNC_INTERVALS = ['5 хв', '15 хв', '30 хв'] as const;
export const DEFAULT_SYNC_INTERVAL = '15 хв';

/** Local document id of the document being scanned right now. */
export const ACTIVE_DOCUMENT_ID = 'active';

export const DEFAULT_USER_NAME = 'Комірник';

/** AsyncStorage keys (non-secret preferences). Secrets live in SecureStorage. */
export const STORAGE_KEYS = {
    serverUrl: 'serverUrl',
    user: 'sf_user',
    autoSync: 'sf_auto_sync',
    soundOn: 'sf_scanner_sound',
    vibrationOn: 'sf_scanner_vibration',
    syncInterval: 'sf_sync_interval',
    warehouse: 'sf_warehouse',
    pullCursor: 'sf_pull_cursor',
} as const;

/** SecureStorage keys (tokens, PIN). */
export const SECURE_KEYS = {
    token: 'sf_token',
    refresh: 'sf_refresh',
    pin: 'sf_pin',
} as const;
