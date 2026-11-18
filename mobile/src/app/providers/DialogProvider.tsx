/** One app-wide dialog, shown above every screen (also on the login screen). */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { View } from 'react-native';
import Modal from '../../components/ui/Modal';
import type { AppDialog, DialogAction, ShowDialog } from '../../types';
import { getErrorMessage } from '../../utils/formatters';
import { PermissionError } from '../../features/auth/services/PermissionService';

type DialogContextValue = {
    showDialog: ShowDialog;
    closeDialog: () => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

const DEFAULT_ACTIONS: DialogAction[] = [{ label: 'Зрозуміло', tone: 'primary' }];

export function DialogProvider({ children }: { children: React.ReactNode }) {
    const [dialog, setDialog] = useState<AppDialog | null>(null);

    const showDialog = useCallback<ShowDialog>((title, message = '', actions = DEFAULT_ACTIONS, kind = 'info') => {
        setDialog({ title, message, actions, kind });
    }, []);
    const closeDialog = useCallback(() => setDialog(null), []);

    const runAction = useCallback(
        async (action: DialogAction, value?: string) => {
            try {
                setDialog(null);
                await action.onPress?.(value);
            } catch (error) {
                showDialog(
                    error instanceof PermissionError ? 'Недостатньо прав' : 'Не вдалося виконати дію',
                    getErrorMessage(error),
                    undefined,
                    error instanceof PermissionError ? 'permission' : 'error',
                );
            }
        },
        [showDialog],
    );

    const value = useMemo(() => ({ showDialog, closeDialog }), [showDialog, closeDialog]);

    return (
        <DialogContext.Provider value={value}>
            <View style={{ flex: 1 }}>
                {children}
                {dialog && (
                    <Modal dialog={dialog} onClose={closeDialog} onAction={(action, v) => void runAction(action, v)} />
                )}
            </View>
        </DialogContext.Provider>
    );
}

export function useDialog(): DialogContextValue {
    const context = useContext(DialogContext);
    if (!context) throw new Error('useDialog must be used inside DialogProvider');
    return context;
}
