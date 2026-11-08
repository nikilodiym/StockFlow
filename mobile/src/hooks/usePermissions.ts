import { useAuth } from '../app/providers/AuthProvider';
import { useSettings } from '../app/providers/SettingsProvider';
import { useDialog } from '../app/providers/DialogProvider';
import {
    canPerform,
    PermissionError,
    type Permission,
    type PermissionDocument,
} from '../features/auth/services/PermissionService';
import { warehouseId } from '../features/inventory/services/DocumentService';
import { getErrorMessage } from '../utils/formatters';

export function usePermissions() {
    const { user } = useAuth();
    const { warehouse } = useSettings();
    const { showDialog } = useDialog();
    const can = (action: Permission, document?: PermissionDocument) =>
        canPerform(user, action, warehouseId(warehouse), document);
    const requirePermission = (action: Permission, document?: PermissionDocument) => {
        if (!can(action, document)) throw new PermissionError();
    };
    const reportError = (error: unknown, title = 'Не вдалося виконати дію') => {
        showDialog(
            error instanceof PermissionError ? 'Недостатньо прав' : title,
            getErrorMessage(error),
            undefined,
            error instanceof PermissionError ? 'permission' : 'error',
        );
    };
    return { can, requirePermission, reportError };
}
