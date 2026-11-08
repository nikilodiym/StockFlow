/** Is the API reachable? Checks /health/ now and then every HEALTH_POLL_MS. */
import { useEffect, useState } from 'react';
import { HEALTH_POLL_MS, TIMEOUTS } from '../constants/config';
import { fetchWithTimeout, joinUrl } from '../services/api/client';
import { ENDPOINTS } from '../services/api/endpoints';

export function useNetworkStatus(serverUrl: string) {
    const [online, setOnline] = useState(false);

    useEffect(() => {
        let active = true;
        const check = async () => {
            try {
                const response = await fetchWithTimeout(joinUrl(serverUrl, ENDPOINTS.health), {}, TIMEOUTS.health);
                if (active) setOnline(response.ok);
            } catch {
                if (active) setOnline(false);
            }
        };
        void check();
        const timer = setInterval(check, HEALTH_POLL_MS);
        return () => {
            active = false;
            clearInterval(timer);
        };
    }, [serverUrl]);

    return { online, setOnline };
}
