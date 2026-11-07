export function displayBusinessName(value: unknown, fallback = 'Toko tanpa nama'): string {
    if (typeof value !== 'string')
        return fallback;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
}
