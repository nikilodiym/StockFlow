import { pendingMigrations, LATEST_VERSION } from '../src/database/migrations';
import { parseServerUrl, serverCandidates } from '../src/services/api/server';
import { csvCell, recordsLabel, uuid } from '../src/utils/formatters';
import { isValidPin, isValidPort, normalizeEmail, parseQuantity, sanitizePin } from '../src/utils/validators';

describe('validators', () => {
    it('parseQuantity accepts comma decimals and rejects zero/negative/text', () => {
        expect(parseQuantity('2,5')).toBe(2.5);
        expect(parseQuantity('0')).toBeNull();
        expect(parseQuantity('-1')).toBeNull();
        expect(parseQuantity('abc')).toBeNull();
    });
    it('ports and PINs', () => {
        expect(isValidPort('8000')).toBe(true);
        expect(isValidPort('70000')).toBe(false);
        expect(isValidPin('1234')).toBe(true);
        expect(isValidPin('12a4')).toBe(false);
        expect(sanitizePin('12-34-56')).toBe('1234');
    });
    it('normalizeEmail', () => expect(normalizeEmail('  Ivan@X.UA ')).toBe('ivan@x.ua'));
});

describe('formatters', () => {
    it('recordsLabel', () => {
        expect(recordsLabel(0)).toBe('записів');
        expect(recordsLabel(1)).toBe('запис');
        expect(recordsLabel(3)).toBe('записи');
    });
    it('csvCell escapes quotes', () => expect(csvCell('a"b')).toBe('"a""b"'));
    it('uuid looks like v4', () =>
        expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/));
});

describe('server address', () => {
    it('parseServerUrl splits host and port', () => {
        expect(parseServerUrl('http://192.168.0.110:8000/api')).toEqual({ host: '192.168.0.110', port: '8000' });
        expect(parseServerUrl('https://api.example.com/api')).toEqual({ host: 'api.example.com', port: '8000' });
    });
    it('serverCandidates puts the saved address first, without duplicates', () => {
        const list = serverCandidates('http://10.0.0.5:8000/api/');
        expect(list[0]).toBe('http://10.0.0.5:8000/api');
        expect(new Set(list).size).toBe(list.length);
        expect(list).toContain('http://localhost:8000/api');
    });
});

describe('migrations', () => {
    it('runs only missing versions, in order', () => {
        expect(pendingMigrations(0).map((m) => m.version)).toEqual([1, 2, 3]);
        expect(pendingMigrations(1).map((m) => m.version)).toEqual([2, 3]);
        expect(pendingMigrations(LATEST_VERSION)).toEqual([]);
    });
});
