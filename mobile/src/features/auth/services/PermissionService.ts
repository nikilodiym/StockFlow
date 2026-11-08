import type { UserData } from '../types/auth.types';

export type Permission =
    'catalog.create' | 'document.create' | 'document.edit' | 'document.post' | 'document.delete' | 'document.print';
export type PermissionDocument = { status?: string; warehouse?: number; created_by?: number | null };

export class PermissionError extends Error {
    constructor(
        message = 'Недостатньо прав для виконання цієї дії. Зверніться до адміністратора або керівника складу.',
    ) {
        super(message);
        this.name = 'PermissionError';
    }
}

export function roleOn(user: UserData | null, warehouse: number): 'admin' | 'manager' | 'worker' | null {
    if (!user || user.is_active === false) return null;
    if (user.is_staff) return 'admin';
    return user.memberships?.find((m) => m.warehouse === warehouse)?.role ?? null;
}

export function canPerform(
    user: UserData | null,
    action: Permission,
    warehouse: number,
    document?: PermissionDocument,
): boolean {
    const role = roleOn(user, document?.warehouse ?? warehouse);
    if (!role) return false;
    if (action === 'catalog.create') return role === 'admin';
    if (action === 'document.print' || action === 'document.create') return true;
    if (action === 'document.post') return role === 'admin' || role === 'manager';
    if (document && document.status !== 'draft') return false;
    return role === 'admin' || role === 'manager' || !document || (!!user?.id && document.created_by === user.id);
}
