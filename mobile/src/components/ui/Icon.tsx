import React from 'react';
import Svg, { Path } from 'react-native-svg';
import reference from '../../assets/icons/reference-icons.json';

const simple = {
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    close: 'M6 6l12 12M18 6L6 18',
    chevron: 'M9 6l6 6-6 6',
    chevronDown: 'M5 9l7 7 7-7',
    upload: 'M12 16V3M7 8l5-5 5 5M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3',
    share: 'M12 16V3M7 8l5-5 5 5M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3',
    server: 'M4 2h16a2 2 0 012 2v5a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2ZM4 13h16a2 2 0 012 2v5a2 2 0 01-2 2H4a2 2 0 01-2-2v-5a2 2 0 012-2ZM6 6h.01M6 17h.01',
    port: 'M4 4h16a2 2 0 012 2v10h-4l-2 4H8l-2-4H2V6a2 2 0 012-2ZM6 7v3M10 7v3M14 7v3M18 7v3',
    logout: 'M9 4H5a2 2 0 00-2 2v12a2 2 0 002 2h4M9 12h12M17 8l4 4-4 4',
} as const;
export type IconName = keyof typeof reference | keyof typeof simple;
type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };
/** Original curves from the WareGo mockups, rendered as scalable vectors. */
export default function Icon({ name, size = 24, color = '#182021', strokeWidth }: Props) {
    const original = (reference as Record<string, { viewBox: string; paths: { d: string; width: number }[] }>)[name];
    return (
        <Svg width={size} height={size} viewBox={original?.viewBox ?? '0 0 24 24'} fill="none" accessible={false}>
            {original ? (
                original.paths.map((p, i) => (
                    <Path
                        key={i}
                        d={p.d}
                        stroke={color}
                        strokeWidth={strokeWidth ?? p.width}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ))
            ) : (
                <Path
                    d={simple[name as keyof typeof simple]}
                    stroke={color}
                    strokeWidth={strokeWidth ?? 1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            )}
        </Svg>
    );
}
