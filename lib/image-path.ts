const LEGACY_LOCAL_EXTENSION = /\.(jpe?g|webp)$/i;
export const AVIF_EXTENSION = '.avif';
export function resolveImageSrc(src: string | null | undefined): string {
    const value = (src ?? '').trim();
    if (!value)
        return '';
    if (!value.startsWith('/') || value.startsWith('//'))
        return value;
    const cut = value.search(/[?#]/);
    const path = cut === -1 ? value : value.slice(0, cut);
    const suffix = cut === -1 ? '' : value.slice(cut);
    return `${path.replace(LEGACY_LOCAL_EXTENSION, AVIF_EXTENSION)}${suffix}`;
}
export function imageSrcVariants(src: string | null | undefined): string[] {
    const value = (src ?? '').trim();
    if (!value)
        return [];
    const resolved = resolveImageSrc(value);
    const variants = new Set<string>([value, resolved]);
    if (resolved.endsWith(AVIF_EXTENSION)) {
        const withoutAvif = resolved.slice(0, -AVIF_EXTENSION.length);
        variants.add(`${withoutAvif}.jpg`);
        variants.add(`${withoutAvif}.jpeg`);
        variants.add(`${withoutAvif}.webp`);
    }
    return Array.from(variants);
}
