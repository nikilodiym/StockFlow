/** Shared TypeScript types used across features. Feature-specific types live in features/<name>/types. */

export type DialogKind = 'info' | 'success' | 'error' | 'confirm' | 'sheet' | 'input' | 'permission';

export type DialogAction = {
    label: string;
    description?: string;
    /** For 'input' dialogs the typed value is passed in. */
    onPress?: (value?: string) => void | Promise<void>;
    tone?: 'primary' | 'danger' | 'neutral';
};

export type AppDialog = {
    title: string;
    message?: string;
    kind?: DialogKind;
    actions: DialogAction[];
    placeholder?: string;
};

export type ShowDialog = (title: string, message?: string, actions?: DialogAction[], kind?: DialogKind) => void;
