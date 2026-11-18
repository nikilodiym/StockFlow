/** Bundled Roboto faces; no platform-specific substitute or synthetic bold. */
export function robotoFamily(weight: unknown = '400'): string {
    const n = weight === 'bold' ? 700 : Number(weight) || 400;
    return n >= 700
        ? 'Roboto_700Bold'
        : n >= 600
          ? 'Roboto_600SemiBold'
          : n >= 500
            ? 'Roboto_500Medium'
            : 'Roboto_400Regular';
}
