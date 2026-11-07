export const DEFAULT_WEIGHT_BY_CATEGORY: Record<string, number> = {
    'makanan berat': 350,
    'makanan cepat saji': 300,
    japanese: 350,
    minuman: 400,
    dessert: 200,
    jajanan: 200,
    'snack & jajanan': 200,
    'roti & kue': 300,
    'buah & sayur': 500,
};
export const DEFAULT_WEIGHT_FALLBACK_GRAM = 300;
export const DEFAULT_PACKAGE_CM = { length: 20, width: 15, height: 10 };
export function resolvePackageWeightGram(weightGram: unknown, category?: string | null): number | null {
    const explicit = typeof weightGram === 'number' ? weightGram : Number(weightGram ?? NaN);
    if (Number.isFinite(explicit) && explicit > 0)
        return Math.floor(explicit);
    const key = typeof category === 'string' ? category.trim().toLowerCase() : '';
    if (key && DEFAULT_WEIGHT_BY_CATEGORY[key])
        return DEFAULT_WEIGHT_BY_CATEGORY[key];
    return DEFAULT_WEIGHT_FALLBACK_GRAM;
}
export function isDefaultPackageWeight(weightGram: unknown): boolean {
    const explicit = typeof weightGram === 'number' ? weightGram : Number(weightGram ?? NaN);
    return !(Number.isFinite(explicit) && explicit > 0);
}
