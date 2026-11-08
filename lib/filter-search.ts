const STRUCTURAL_CHARS = /[%(),]/g;
export function sanitizeSearchTerm(raw: string | null | undefined, maxLength = 100): string {
    if (typeof raw !== 'string')
        return '';
    return raw
        .trim()
        .slice(0, Math.max(0, maxLength))
        .replace(STRUCTURAL_CHARS, '');
}
export function sanitizeSearchTermKeepingWords(raw: string | null | undefined, maxLength = 100): string {
    if (typeof raw !== 'string')
        return '';
    return raw
        .trim()
        .slice(0, Math.max(0, maxLength))
        .replace(STRUCTURAL_CHARS, ' ')
        .trim();
}
export function isStructuralSafe(term: string): boolean {
    return !/[%(),]/.test(term);
}
