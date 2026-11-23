jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { pullQuery } from '../PullService';

describe('pullQuery', () => {
    it('reports the device and the outbox size', () => {
        const params = new URLSearchParams(pullQuery(null, 3, 'android').slice(1));
        expect(params.get('device_id')).toBe('android');
        expect(params.get('pending')).toBe('3');
        expect(params.has('cursor')).toBe(false);
    });

    it('keeps the cursor', () => {
        const params = new URLSearchParams(pullQuery('2026-11-23T10:00:00+02:00', 0, 'ios').slice(1));
        expect(params.get('cursor')).toBe('2026-11-23T10:00:00+02:00');
        expect(params.get('pending')).toBe('0');
    });
});
