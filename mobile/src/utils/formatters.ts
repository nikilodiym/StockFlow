/** Formatting helpers (pure functions). */

export function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Сталася невідома помилка.';
}

/** 08.11 */
export const dateLabel = (iso: string): string =>
    new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });

/** 14:05 */
export const timeLabel = (date: Date = new Date()): string =>
    date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

/** 8 листопада */
export const longDateLabel = (date: Date = new Date()): string =>
    date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });

/** 1 запис / 2 записи / 0 записів (as used on the sync card). */
export const recordsLabel = (count: number): string =>
    count === 1 ? 'запис' : count === 0 ? 'записів' : 'записи';

/** Quoted CSV cell: "Кава ""Арабіка""". */
export const csvCell = (value: string): string => `"${value.replace(/"/g, '""')}"`;

/** RFC 4122 v4 id generated on the device (documents are created offline). */
export const uuid = (): string =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 3) | 8).toString(16);
    });
