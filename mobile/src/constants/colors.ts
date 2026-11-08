/** App palette (WareGo). Use these instead of hex literals in components. */
export const colors = {
    primary: '#12715B',
    text: '#26302A',
    textStrong: '#1F2823',
    black: '#0E0F10',
    white: '#FFFFFF',
    muted: '#707A74',
    mutedIcon: '#66726A',
    closeIcon: '#6E7772',
    yellowText: '#202723',
    danger: '#C93C3C',
    background: '#F2F3F2',
} as const;

export type ColorName = keyof typeof colors;
