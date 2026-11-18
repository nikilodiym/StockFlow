import { formatLoginError, LoginError } from '../utils/loginErrors';

describe('login error messages', () => {
    it('does not blame server connectivity when credentials are rejected', () => {
        const message = formatLoginError(new LoginError('Невірний email або пароль', 401), 'http://server/api');
        expect(message).toContain('Невірний email або пароль');
        expect(message).toContain('Сервер доступний');
        expect(message).not.toMatch(/docker|npm run|Wi-Fi/);
    });

    it('distinguishes a server error from a network error', () => {
        const message = formatLoginError(new LoginError('Помилка входу: 500', 500), 'http://server/api');
        expect(message).toContain('журнал API');
        expect(message).not.toContain('docker');
    });

    it('uses the failed server address and emulator guidance for a network failure', () => {
        const error = Object.assign(new Error('Network request failed'), { serverUrl: 'http://10.0.2.2:8000/api' });
        const message = formatLoginError(error, 'http://old-server/api');
        expect(message).toContain('http://10.0.2.2:8000/api');
        expect(message).toContain('npm run api');
        expect(message).not.toContain('old-server');
    });
});
