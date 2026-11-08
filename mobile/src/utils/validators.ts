/** Input validation helpers (pure functions). */

/** "2,5" → 2.5; null when not a positive number. */
export function parseQuantity(text: string): number | null {
    const value = Number(text.replace(',', '.'));
    return Number.isFinite(value) && value > 0 ? value : null;
}

export function isValidPort(port: string): boolean {
    return /^\d{1,5}$/.test(port) && Number(port) >= 1 && Number(port) <= 65535;
}

export const isValidPin = (pin: string): boolean => /^\d{4}$/.test(pin);

/** Keeps only digits, max 4 (PIN input). */
export const sanitizePin = (value: string): string => value.replace(/\D/g, '').slice(0, 4);

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
