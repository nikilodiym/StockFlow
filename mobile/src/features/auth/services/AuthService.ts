/** Login against the API, with one retry on another reachable server address. */
import { DEFAULT_USER_NAME, TIMEOUTS } from '../../../constants/config';
import { apiRequest, readJson } from '../../../services/api/client';
import { ENDPOINTS } from '../../../services/api/endpoints';
import { findServer, serverCandidates } from '../../../services/api/server';
import type { LoginResponse, Session, UserData } from '../types/auth.types';
import { LoginError } from '../utils/loginErrors';

export type LoginResult = Session & { serverUrl: string };

/** Name shown in the app for a user profile. */
export const displayName = (user: UserData | null | undefined, fallback: string = DEFAULT_USER_NAME): string =>
    user?.name || user?.username || user?.email || fallback;

/** Turns the login response into a session or throws a readable error. */
export function parseLoginResponse(ok: boolean, status: number, data: LoginResponse, serverUrl?: string): Session {
    if (!ok) throw new LoginError(data.detail || data.message || data.error || `Помилка входу: ${status}`, status, serverUrl);
    const token = data.access || data.tokens?.access;
    if (!token) throw new Error('Сервер не повернув токен доступу. Перевірте формат відповіді API.');
    return { token, refresh: data.refresh || data.tokens?.refresh || null, user: data.user || data.profile || null };
}

export const AuthService = {
    /**
     * Email + password. If the saved server is unreachable from this device,
     * looks for the server at the other candidate addresses once.
     */
    async login(serverUrl: string, email: string, password: string): Promise<LoginResult> {
        const request = (base: string) =>
            apiRequest(base, ENDPOINTS.login, { method: 'POST', body: { email, password }, timeout: TIMEOUTS.login });

        let base = serverUrl.replace(/\/$/, '');
        let response: Response;
        try {
            response = await request(base);
        } catch (networkError) {
            const found = await findServer(serverCandidates(base).filter(url => url !== base));
            if (!found) throw Object.assign(networkError as Error, { serverUrl: base });
            base = found;
            response = await request(found);
        }
        const session = parseLoginResponse(response.ok, response.status, await readJson<LoginResponse>(response), base);
        return { ...session, serverUrl: base };
    },

    /**
     * New access token from the refresh token (access lives 20 min on the server).
     * Returns null when the refresh token itself is expired or revoked.
     */
    async refresh(serverUrl: string, refreshToken: string): Promise<{ token: string; refresh: string | null } | null> {
        const response = await apiRequest(serverUrl, ENDPOINTS.refresh, { method: 'POST', body: { refresh: refreshToken }, timeout: TIMEOUTS.login });
        if (!response.ok) return null;
        const data = await readJson<{ access?: string; refresh?: string }>(response);
        return data.access ? { token: data.access, refresh: data.refresh ?? refreshToken } : null;
    },
};
