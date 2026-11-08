/** API paths, relative to the base URL (http://host:8000/api). */
export const ENDPOINTS = {
    health: '/health/',
    login: '/auth/login/',
    refresh: '/auth/refresh/',
    /** Old sync format still used by the outbox: {device_id, changes:[{client_id, document}]}. */
    legacySync: '/sync/',
    pull: '/sync/pull/',
} as const;
