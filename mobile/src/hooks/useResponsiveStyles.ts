import { useMemo } from 'react';
import { Dimensions, useWindowDimensions } from 'react-native';
import { responsiveMetrics, scaleStyles } from '../utils/responsive';

/** Recompute on rotation, split-screen resizing and accessibility-font changes. */
export function useResponsiveStyles<T extends Record<string, object>>(styles: T): T {
    const { width, height, fontScale } = useWindowDimensions();
    const screen = Dimensions.get('screen');
    // Opening the keyboard must not suddenly shrink all fonts. Window width
    // still adapts to split-screen; screen's short side stabilizes keyboard height.
    const layoutHeight = Math.max(height, Math.min(screen.width, screen.height));
    return useMemo(
        () => scaleStyles(styles, responsiveMetrics(width, layoutHeight, fontScale)),
        [styles, width, layoutHeight, fontScale],
    );
}
