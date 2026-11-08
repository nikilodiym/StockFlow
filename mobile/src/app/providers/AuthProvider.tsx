/**
 * Who is logged in: JWT session, PIN unlock, sign in / out.
 * RootNavigator shows the login flow while `isAuthenticated` is false.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AuthRepository } from '../../features/auth/repositories/AuthRepository';
import { AuthService, displayName } from '../../features/auth/services/AuthService';
import type { UserData } from '../../features/auth/types/auth.types';
import { normalizeEmail } from '../../utils/validators';
import { apiRequest, readJson } from '../../services/api/client';
import { useSettings } from './SettingsProvider';

type AuthContextValue = {
    user: UserData | null;
    /** Restoring the saved session on startup. */
    initializing: boolean;
    token: string;
    userName: string;
    userEmail: string;
    /** PIN saved on this device ('' when not set). */
    storedPin: string;
    /** Session exists but the PIN screen must be passed first. */
    needsUnlock: boolean;
    isAuthenticated: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    /** true when the PIN matched. */
    unlockWithPin: (pin: string) => boolean;
    savePin: (pin: string) => Promise<void>;
    signOut: () => Promise<void>;
    /** Gets a fresh access token with the refresh token; null if the session is over. */
    refreshToken: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const { serverUrl, applyServerUrl } = useSettings();
    const [initializing, setInitializing] = useState(true);
    const [token, setToken] = useState('');
    const [user, setUser] = useState<UserData | null>(null);
    const [storedPin, setStoredPin] = useState('');
    const [needsUnlock, setNeedsUnlock] = useState(false);
    const [refresh, setRefresh] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        void (async () => {
            const [session, pin] = await Promise.all([AuthRepository.loadSession(), AuthRepository.loadPin()]);
            if (!active) return;
            if (session) {
                setToken(session.token);
                setRefresh(session.refresh);
                setUser(session.user);
            }
            if (pin) {
                setStoredPin(pin);
                setNeedsUnlock(!!session);
            }
        })()
            .catch((error) => console.error('Помилка відновлення сесії:', error))
            .finally(() => {
                if (active) setInitializing(false);
            });
        return () => {
            active = false;
        };
    }, []);

    const signIn = useCallback(
        async (email: string, password: string) => {
            const result = await AuthService.login(serverUrl, normalizeEmail(email), password);
            if (result.serverUrl !== serverUrl) await applyServerUrl(result.serverUrl);
            const profile = result.user ?? { email: normalizeEmail(email) };
            await AuthRepository.saveSession({ token: result.token, refresh: result.refresh, user: profile });
            setUser(profile);
            setToken(result.token);
            setRefresh(result.refresh);
            setNeedsUnlock(false);
        },
        [serverUrl, applyServerUrl],
    );

    const unlockWithPin = useCallback(
        (pin: string) => {
            if (pin !== storedPin) return false;
            setNeedsUnlock(false);
            return true;
        },
        [storedPin],
    );

    const savePin = useCallback(async (pin: string) => {
        await AuthRepository.savePin(pin);
        setStoredPin(pin);
    }, []);

    const signOut = useCallback(async () => {
        await AuthRepository.clearSession();
        setToken('');
        setRefresh(null);
        setUser(null);
        setNeedsUnlock(false);
    }, []);

    const refreshToken = useCallback(async () => {
        if (!refresh) return null;
        const renewed = await AuthService.refresh(serverUrl, refresh).catch(() => null);
        if (!renewed) return null;
        await AuthRepository.saveSession({ token: renewed.token, refresh: renewed.refresh, user });
        setToken(renewed.token);
        setRefresh(renewed.refresh);
        return renewed.token;
    }, [refresh, serverUrl, user]);

    // Refresh roles as well as the profile; older saved sessions had no role fields.
    useEffect(() => {
        if (!token) return;
        let active = true;
        void apiRequest(serverUrl, '/auth/me/', { token })
            .then(async (response) => {
                if (!response.ok) return;
                const profile = await readJson<UserData>(response);
                if (!active || !profile.id) return;
                setUser(profile);
                await AuthRepository.saveSession({ token, refresh, user: profile });
            })
            .catch(() => {
                /* Offline: keep the last server-verified profile. */
            });
        return () => {
            active = false;
        };
    }, [token, serverUrl, refresh]);

    const value = useMemo<AuthContextValue>(
        () => ({
            user,
            initializing,
            token,
            userName: displayName(user),
            userEmail: user?.email ?? '',
            storedPin,
            needsUnlock,
            isAuthenticated: !!token && !needsUnlock,
            signIn,
            unlockWithPin,
            savePin,
            signOut,
            refreshToken,
        }),
        [initializing, token, user, storedPin, needsUnlock, signIn, unlockWithPin, savePin, signOut, refreshToken],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used inside AuthProvider');
    return context;
}
