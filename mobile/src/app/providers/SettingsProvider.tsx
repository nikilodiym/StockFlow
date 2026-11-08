/**
 * Device settings: server address (with auto-discovery), connectivity, warehouse,
 * sync preferences, scanner sound/vibration.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_SYNC_INTERVAL, DEFAULT_WAREHOUSE } from '../../constants/config';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { DEFAULT_API_URL, findServer, parseServerUrl, serverCandidates } from '../../services/api/server';
import { SettingsService } from '../../features/settings/services/SettingsService';

type SettingsContextValue = {
    serverUrl: string;
    /** Form values on the Settings screen. */
    serverHost: string;
    serverPort: string;
    setServerHost: (value: string) => void;
    setServerPort: (value: string) => void;
    /** Use and remember a server address. */
    applyServerUrl: (url: string) => Promise<void>;
    online: boolean;
    setOnline: (value: boolean) => void;
    /** "Онлайн" switch on the Home screen. */
    onlineMode: boolean;
    setOnlineMode: (value: boolean | ((prev: boolean) => boolean)) => void;
    warehouse: string;
    chooseWarehouse: (value: string) => Promise<void>;
    autoSync: boolean;
    toggleAutoSync: () => Promise<void>;
    syncInterval: string;
    chooseSyncInterval: (value: string) => Promise<void>;
    soundOn: boolean;
    toggleSound: () => void;
    vibrationOn: boolean;
    toggleVibration: () => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [serverUrl, setServerUrl] = useState(DEFAULT_API_URL);
    const [serverHost, setServerHost] = useState(parseServerUrl(DEFAULT_API_URL).host);
    const [serverPort, setServerPort] = useState(parseServerUrl(DEFAULT_API_URL).port);
    const [onlineMode, setOnlineMode] = useState(false);
    const [warehouse, setWarehouse] = useState<string>(DEFAULT_WAREHOUSE);
    const [autoSync, setAutoSync] = useState(true);
    const [syncInterval, setSyncInterval] = useState<string>(DEFAULT_SYNC_INTERVAL);
    const [soundOn, setSoundOn] = useState(true);
    const [vibrationOn, setVibrationOn] = useState(true);
    const { online, setOnline } = useNetworkStatus(serverUrl);

    const showServer = useCallback((url: string) => {
        const { host, port } = parseServerUrl(url);
        setServerUrl(url);
        setServerHost(host);
        setServerPort(port);
    }, []);

    const applyServerUrl = useCallback(
        async (url: string) => {
            showServer(url);
            await SettingsService.saveServerUrl(url);
        },
        [showServer],
    );

    useEffect(() => {
        let active = true;
        void (async () => {
            const prefs = await SettingsService.load();
            if (!active) return;
            setAutoSync(prefs.autoSync);
            setSoundOn(prefs.soundOn);
            setVibrationOn(prefs.vibrationOn);
            setSyncInterval(prefs.syncInterval);
            setWarehouse(prefs.warehouse);
            // A saved address goes stale on another emulator or phone, so it is
            // only the first candidate: then Metro host, 10.0.2.2, localhost.
            if (prefs.serverUrl) showServer(prefs.serverUrl);
            const found = await findServer(serverCandidates(prefs.serverUrl));
            if (!active || !found) return;
            showServer(found);
            if (found !== prefs.serverUrl) await SettingsService.saveServerUrl(found);
        })().catch((error) => console.error('Помилка завантаження налаштувань:', error));
        return () => {
            active = false;
        };
    }, [showServer]);

    const chooseWarehouse = useCallback(async (value: string) => {
        setWarehouse(value);
        await SettingsService.saveWarehouse(value);
    }, []);

    const toggleAutoSync = useCallback(async () => {
        const next = !autoSync;
        setAutoSync(next);
        await SettingsService.saveAutoSync(next);
    }, [autoSync]);

    const chooseSyncInterval = useCallback(async (value: string) => {
        setSyncInterval(value);
        await SettingsService.saveSyncInterval(value);
    }, []);

    const toggleSound = useCallback(() => {
        const next = !soundOn;
        setSoundOn(next);
        void SettingsService.saveSound(next).catch((error) => {
            setSoundOn(!next);
            console.error(error);
        });
    }, [soundOn]);
    const toggleVibration = useCallback(() => {
        const next = !vibrationOn;
        setVibrationOn(next);
        void SettingsService.saveVibration(next).catch((error) => {
            setVibrationOn(!next);
            console.error(error);
        });
    }, [vibrationOn]);

    const value = useMemo<SettingsContextValue>(
        () => ({
            serverUrl,
            serverHost,
            serverPort,
            setServerHost,
            setServerPort,
            applyServerUrl,
            online,
            setOnline,
            onlineMode,
            setOnlineMode,
            warehouse,
            chooseWarehouse,
            autoSync,
            toggleAutoSync,
            syncInterval,
            chooseSyncInterval,
            soundOn,
            toggleSound,
            vibrationOn,
            toggleVibration,
        }),
        [
            serverUrl,
            serverHost,
            serverPort,
            applyServerUrl,
            online,
            setOnline,
            onlineMode,
            warehouse,
            chooseWarehouse,
            autoSync,
            toggleAutoSync,
            syncInterval,
            chooseSyncInterval,
            soundOn,
            vibrationOn,
            toggleSound,
            toggleVibration,
        ],
    );

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
    const context = useContext(SettingsContext);
    if (!context) throw new Error('useSettings must be used inside SettingsProvider');
    return context;
}
