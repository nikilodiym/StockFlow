import { responsiveMetrics, scaleStyles } from '../src/utils/responsive';

const phone6 = { width: 1080 / (420 / 160), height: 2400 / (420 / 160) };
const phone9 = { width: 1280 / (480 / 160), height: 2856 / (480 / 160) };
const styles = {
    title: { fontSize: 22, lineHeight: 28 },
    input: { fontSize: 16, height: 44, paddingHorizontal: 12 },
    row: { flex: 1, width: '100%', borderWidth: 1, backgroundColor: '#fff' },
};

describe('responsive layout', () => {
    it('gives Pixel 9 Pro larger text than Pixel 6 using their actual logical display sizes', () => {
        const smaller = scaleStyles(styles, responsiveMetrics(phone6.width, phone6.height));
        const larger = scaleStyles(styles, responsiveMetrics(phone9.width, phone9.height));
        expect(larger.title.fontSize).toBeGreaterThan(smaller.title.fontSize);
        expect(larger.title.fontSize).toBeLessThanOrEqual(styles.title.fontSize * 1.18 + 0.1);
    });
    it('keeps text bounded from a narrow phone through a tablet', () => {
        for (const width of [320, 360, 390, 412, 427, 600, 1024]) {
            const metrics = responsiveMetrics(width, 1366);
            expect(metrics.typography).toBeGreaterThanOrEqual(0.92);
            expect(metrics.typography).toBeLessThanOrEqual(1.18);
        }
    });
    it('keeps the same font size when rotating a phone', () => {
        expect(responsiveMetrics(412, 915).typography).toBe(responsiveMetrics(915, 412).typography);
    });
    it('leaves system font scaling to Text and expands controls instead of clipping it', () => {
        const normal = scaleStyles(styles, responsiveMetrics(427, 952, 1));
        const accessible = scaleStyles(styles, responsiveMetrics(427, 952, 2));
        expect(accessible.input.fontSize).toBe(normal.input.fontSize);
        expect(accessible.input).not.toHaveProperty('height');
        expect(accessible.input).toHaveProperty('minHeight', expect.any(Number));
        expect((accessible.input as unknown as { minHeight: number }).minHeight).toBeGreaterThan(
            (normal.input as unknown as { minHeight: number }).minHeight,
        );
    });
    it('preserves responsive widths, colors, flex ratios and border hairlines', () => {
        expect(scaleStyles(styles, responsiveMetrics(427, 952)).row).toEqual(styles.row);
        expect(styles.input.height).toBe(44);
    });
    it('has safe defaults for unavailable viewport measurements', () => {
        expect(responsiveMetrics(0, 0).typography).toBe(1);
        expect(responsiveMetrics(NaN, 800).typography).toBe(1);
    });
});
