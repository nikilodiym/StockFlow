import { displayName, parseLoginResponse } from '../services/AuthService';

describe('parseLoginResponse', () => {
    it('returns the session from the current API format', () => {
        expect(parseLoginResponse(true, 200, { access: 'a', refresh: 'r', user: { name: 'Іван' } })).toEqual({ token: 'a', refresh: 'r', user: { name: 'Іван' } });
    });

    it('accepts the older {tokens, profile} format', () => {
        expect(parseLoginResponse(true, 200, { tokens: { access: 'a' }, profile: { email: 'x@y.ua' } })).toEqual({ token: 'a', refresh: null, user: { email: 'x@y.ua' } });
    });

    it('throws the server message on error', () => {
        expect(() => parseLoginResponse(false, 401, { detail: 'Невірний email або пароль' })).toThrow('Невірний email або пароль');
        expect(() => parseLoginResponse(false, 500, {})).toThrow('Помилка входу: 500');
    });

    it('throws when the token is missing', () => {
        expect(() => parseLoginResponse(true, 200, {})).toThrow(/токен/);
    });
});

it('displayName prefers name, then username, then email', () => {
    expect(displayName({ name: 'Іван', email: 'i@x.ua' })).toBe('Іван');
    expect(displayName({ email: 'i@x.ua' })).toBe('i@x.ua');
    expect(displayName(null)).toBe('Комірник');
});
