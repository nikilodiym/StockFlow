import { canPerform, roleOn } from '../services/PermissionService';
import type { UserData } from '../types/auth.types';

const worker: UserData = { id: 10, memberships: [{ warehouse: 1, role: 'worker' }] };
const manager: UserData = { id: 11, memberships: [{ warehouse: 1, role: 'manager' }] };
const admin: UserData = { id: 1, is_staff: true };
describe('warehouse permissions', () => {
    it('grants the administrator every supported action on any warehouse and author drafts', () => {
        for (const action of [
            'catalog.create',
            'document.create',
            'document.edit',
            'document.post',
            'document.delete',
            'document.print',
        ] as const) {
            expect(canPerform(admin, action, 999, { warehouse: 999, status: 'draft', created_by: 10 })).toBe(
                true,
            );
        }
    });
    it('allows only staff to create catalog products', () => {
        expect(canPerform(admin, 'catalog.create', 1)).toBe(true);
        expect(canPerform(manager, 'catalog.create', 1)).toBe(false);
        expect(canPerform(worker, 'catalog.create', 1)).toBe(false);
    });
    it('workers scan into their own drafts and cannot edit another author', () => {
        expect(
            canPerform(worker, 'document.edit', 1, { warehouse: 1, status: 'draft', created_by: 10 }),
        ).toBe(true);
        expect(
            canPerform(worker, 'document.edit', 1, { warehouse: 1, status: 'draft', created_by: 11 }),
        ).toBe(false);
        expect(
            canPerform(worker, 'document.edit', 1, { warehouse: 1, status: 'posted', created_by: 10 }),
        ).toBe(false);
    });
    it('requires manager privileges to post and scopes them to the warehouse', () => {
        expect(canPerform(worker, 'document.post', 1)).toBe(false);
        expect(canPerform(manager, 'document.post', 1)).toBe(true);
        expect(canPerform(manager, 'document.post', 2)).toBe(false);
        expect(canPerform(admin, 'document.post', 2)).toBe(true);
    });
    it('does not invent privileges for a legacy or disabled session', () => {
        expect(roleOn({ email: 'admin@gmail.com' }, 1)).toBeNull();
        expect(canPerform({ ...admin, is_active: false }, 'catalog.create', 1)).toBe(false);
        expect(canPerform(null, 'document.print', 1)).toBe(false);
    });
    it('allows printing on an assigned warehouse, and denies a different warehouse', () => {
        expect(canPerform(worker, 'document.print', 1)).toBe(true);
        expect(canPerform(worker, 'document.print', 1, { warehouse: 2 })).toBe(false);
    });
});
