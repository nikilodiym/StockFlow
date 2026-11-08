/** Sync state for the whole app: manual sync, auto-sync, notification read flag. */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useInventory } from '../../features/inventory/hooks/useInventory';
import { useProducts } from '../../features/products/hooks/useProducts';
import { SyncService } from '../../services/sync/SyncService';
import { navigateToDocuments } from '../navigation/navigationRef';
import { useAuth } from './AuthProvider';
import { useDialog } from './DialogProvider';
import { useSettings } from './SettingsProvider';
import { usePermissions } from '../../hooks/usePermissions';

type SyncContextValue = {
    syncing: boolean;
    /** showEmptyQueueMessage=false for background auto-sync. */
    sync: (showEmptyQueueMessage?: boolean) => Promise<void>;
    notificationsRead: boolean;
    markNotificationsRead: () => void;
};

const SyncContext = createContext<SyncContextValue | null>(null);

const pulledNote = (pulled: number | null) => (pulled ? `\nОновлено товарів з сервера: ${pulled}.` : '');

export function SyncProvider({ children }: { children: React.ReactNode }) {
    const db = useSQLiteContext();
    const { token, refreshToken } = useAuth();
    const { serverUrl, online, onlineMode, autoSync, syncInterval } = useSettings();
    const { refreshDocs } = useInventory();
    const { reload: reloadProducts } = useProducts();
    const { showDialog } = useDialog();
    const [syncing, setSyncing] = useState(false);
    const [notificationsRead, setNotificationsRead] = useState(false);
    const busy = useRef(false);
    const { reportError } = usePermissions();

    const sync = useCallback(
        async (showEmptyQueueMessage = true) => {
            if (busy.current) return;
            if (!token) {
                showDialog('Потрібен вхід', 'Увійдіть до облікового запису перед синхронізацією.', undefined, 'error');
                return;
            }
            busy.current = true;
            setSyncing(true);
            try {
                let result = await SyncService.run(db, serverUrl, token);
                if (result.push.status === 'unauthorized') {
                    // Access token expired (20 min): renew it once and retry.
                    const renewed = await refreshToken();
                    if (renewed) result = await SyncService.run(db, serverUrl, renewed);
                }
                const { push, pulled } = result;
                await refreshDocs();
                if (pulled) await reloadProducts();

                if (push.status === 'unauthorized') {
                    showDialog(
                        'Потрібен повторний вхід',
                        'Сервер відхилив токен доступу. Увійдіть знову.',
                        undefined,
                        'error',
                    );
                } else if (push.status === 'conflict') {
                    showDialog(
                        'Конфлікт синхронізації',
                        'Сервер і пристрій мають різні зміни. Відкрийте документ і оберіть потрібну версію.',
                        [{ label: 'До документів', tone: 'primary', onPress: navigateToDocuments }],
                        'error',
                    );
                } else if (push.synced > 0) {
                    showDialog(
                        'Синхронізацію завершено',
                        `Передано документів: ${push.synced}.${pulledNote(pulled)}`,
                        undefined,
                        'success',
                    );
                } else if (showEmptyQueueMessage) {
                    showDialog(
                        'Усе синхронізовано',
                        `Немає документів, що очікують передавання.${pulledNote(pulled)}`,
                        undefined,
                        'success',
                    );
                }
            } catch (error) {
                reportError(error, 'Не вдалося синхронізувати');
            } finally {
                busy.current = false;
                setSyncing(false);
            }
        },
        [db, token, refreshToken, serverUrl, refreshDocs, reloadProducts, showDialog],
    );

    // Sync as soon as the network becomes available, then every N minutes.
    const syncRef = useRef(sync);
    syncRef.current = sync;
    useEffect(() => {
        if (autoSync && onlineMode && online && token) void syncRef.current(false);
    }, [onlineMode, online, token, autoSync]);
    useEffect(() => {
        if (!autoSync || !onlineMode || !online || !token) return;
        const minutes = Number.parseInt(syncInterval, 10) || 15;
        const timer = setInterval(() => void syncRef.current(false), minutes * 60 * 1000);
        return () => clearInterval(timer);
    }, [autoSync, onlineMode, online, token, syncInterval]);

    const value = useMemo(
        () => ({
            syncing,
            sync,
            notificationsRead,
            markNotificationsRead: () => setNotificationsRead(true),
        }),
        [syncing, sync, notificationsRead],
    );

    return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
    const context = useContext(SyncContext);
    if (!context) throw new Error('useSync must be used inside SyncProvider');
    return context;
}
