import { robotoFamily } from '../constants/typography';

export type ResponsiveMetrics = { typography: number; spacing: number; fontScale: number; contentWidth: number };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Logical screen units, not physical pixels or a device-model name. */
export function responsiveMetrics(width: number, height: number, fontScale = 1): ResponsiveMetrics {
    const shortSide = Math.min(width, height);
    const size = Number.isFinite(shortSide) && shortSide > 0 ? shortSide : 400;
    return {
        typography: clamp(1 + (size - 400) / 200, 0.92, 1.18),
        spacing: clamp(1 + (size - 400) / 600, 0.94, 1.1),
        // Text itself still respects React Native's system font scaling. This
        // value only gives text-containing controls more room; never scale twice.
        fontScale: Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1,
        contentWidth: 720,
    };
}

const geometry =
    /^(?:padding|margin)(?:Top|Bottom|Left|Right|Horizontal|Vertical|Start|End)?$|^(?:gap|rowGap|columnGap|width|height|minWidth|maxWidth|minHeight|maxHeight|borderRadius|borderTopLeftRadius|borderTopRightRadius|borderBottomLeftRadius|borderBottomRightRadius)$/;
const textControl = /button|input|option|choice|chip|key$|row$|^bottom$|^tab$|^quantity$/i;
const round = (value: number) => Math.round(value * 10) / 10;

/** Transform a style map without changing its source or colors/flex ratios. */
export function scaleStyles<T extends Record<string, object>>(styles: T, metrics: ResponsiveMetrics): T {
    const result: Record<string, object> = {};
    for (const [name, style] of Object.entries(styles)) {
        const scaled: Record<string, unknown> = {};
        for (const [property, value] of Object.entries(style)) {
            scaled[property] =
                typeof value !== 'number'
                    ? value
                    : property === 'fontSize' || property === 'lineHeight'
                      ? round(value * metrics.typography)
                      : geometry.test(property)
                        ? round(value * metrics.spacing)
                        : value;
        }
        if ('fontSize' in scaled || 'fontWeight' in scaled) {
            scaled.fontFamily = robotoFamily(scaled.fontWeight);
            scaled.fontWeight = 'normal';
        }
        // A fixed height clips larger accessibility fonts. Let controls grow
        // with their children while preserving their usual minimum size.
        if (textControl.test(name) && typeof scaled.height === 'number') {
            scaled.minHeight = Math.max(Number(scaled.minHeight) || 0, scaled.height * Math.max(1, metrics.fontScale));
            delete scaled.height;
        } else if (textControl.test(name) && typeof scaled.minHeight === 'number') {
            scaled.minHeight *= Math.max(1, metrics.fontScale);
        }
        if (textControl.test(name) && scaled.justifyContent === 'center' && scaled.paddingVertical === undefined) {
            scaled.paddingVertical = round(6 * metrics.spacing);
        }
        result[name] = scaled;
    }
    return result as T;
}
