import { getErrorMessage } from '../../../utils/formatters';

/** A response from the API is different from a connection failure. */
export class LoginError extends Error {
    constructor(message: string, readonly status: number, public serverUrl?: string) {
        super(message);
        this.name = 'LoginError';
    }
}

export function formatLoginError(error: unknown, fallbackServerUrl: string): string {
    const message = getErrorMessage(error);
    if (error instanceof LoginError) {
        if (error.status === 401) {
            return `${message}\n\nПеревірте email і пароль. Сервер доступний, але не підтвердив дані для входу.`;
        }
        if (error.status >= 500) {
            return `${message}\n\nСервер повернув помилку. Повторіть спробу пізніше або перевірте журнал API.`;
        }
        return message;
    }
    const server = (error as { serverUrl?: string } | null)?.serverUrl ?? fallbackServerUrl;
    return `${message}\n\nСервер: ${server}\nПеревірте, що на комп’ютері запущені база (docker compose up -d db) і API (npm run api). Для Android-емулятора використовуйте http://10.0.2.2:8000/api, для телефона — адресу комп’ютера в тій самій Wi-Fi мережі. Адресу можна змінити в Налаштуваннях.`;
}
