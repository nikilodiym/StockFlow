/** HTTP client: timeouts, base URL and auth header in one place. */
import { TIMEOUTS } from '../../constants/config';

/**
 * Free ngrok tunnels may answer with an HTML warning page instead of the API;
 * this header turns it off (ignored by every other server).
 */
const TUNNEL_HEADERS = { 'ngrok-skip-browser-warning': '1' };

export const joinUrl = (base: string, path: string): string => `${base.replace(/\/$/, '')}${path}`;

/** fetch that gives up after `ms` instead of hanging (React Native fetch has no timeout). */
export async function fetchWithTimeout(url: string, options: RequestInit = {}, ms: number = TIMEOUTS.default): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        const headers = { ...TUNNEL_HEADERS, ...(options.headers as Record<string, string> | undefined) };
        return await fetch(url, { ...options, headers, signal: controller.signal });
    } catch (error) {
        if (controller.signal.aborted) {
            throw new Error(`Сервер не відповів за ${Math.round(ms / 1000)} с (${url.replace(/\/[^/]*\/?$/, '')})`);
        }
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

type RequestOptions = {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: unknown;
    /** Raw string body (already JSON), e.g. a queued outbox payload. */
    rawBody?: string;
    token?: string;
    timeout?: number;
};

export function apiRequest(base: string, path: string, { method = 'GET', body, rawBody, token, timeout }: RequestOptions = {}): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined || rawBody !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetchWithTimeout(
        joinUrl(base, path),
        { method, headers, body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)) },
        timeout,
    );
}

/** Reads a JSON body, returning {} when the server sent something else. */
export async function readJson<T>(response: Response): Promise<T> {
    return (await response.json().catch(() => ({}))) as T;
}
