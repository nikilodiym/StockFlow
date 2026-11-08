/** Barcode handling rules (pure functions, covered by tests). */
import type { BarcodeType } from 'expo-camera';

/** Formats the camera looks for. */
export const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'];

/** Scanner output can contain spaces or line breaks. */
export const normalizeBarcode = (raw: string): string => raw.replace(/\s+/g, '').trim();

/** EAN-13 / EAN-8 check digit is valid. */
export function isValidEan(code: string): boolean {
    if (!/^\d{8}$|^\d{13}$/.test(code)) return false;
    const digits = code.split('').map(Number);
    const check = digits.pop() as number;
    const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
    return (10 - (sum % 10)) % 10 === check;
}

export const QUANTITY_STEPS = ['-1', '+1', '+10'] as const;
export type QuantityStep = (typeof QUANTITY_STEPS)[number];

/** New per-scan quantity after pressing −1 / +1 / +10 (never below 1). */
export function stepQuantity(current: string, step: QuantityStep): string {
    const delta = step === '-1' ? -1 : step === '+10' ? 10 : 1;
    return String(Math.max(1, (Number(current) || 1) + delta));
}
