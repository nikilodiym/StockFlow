/** App palette (WareGo). Use these instead of hex literals in components. */
export const colors = {
    primary: '#12715B',
    text: '#182021',
    textStrong: '#182021',
    black: '#0E0F10',
    white: '#FFFFFF',
    muted: '#606876',
    mutedIcon: '#606876',
    closeIcon: '#606876',
    yellowText: '#0E0F10',
    danger: '#D64545',
    background: '#F3F3F1',
} as const;

export type ColorName = keyof typeof colors;
