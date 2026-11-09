export type FlashStatusFilter = 'Semua' | 'Berlangsung' | 'Akan Datang';
export interface FlashStatusItem {
    startsAt?: string;
    endsAt?: string;
}
export interface FlashStatusWindow {
    startIso: string | null;
    endIso: string | null;
}
function parseTime(value: string | null | undefined): number | null {
    if (!value)
        return null;
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
}
export function matchesFlashStatus(item: FlashStatusItem, filter: FlashStatusFilter, window: FlashStatusWindow, now: number = Date.now()): boolean {
    if (filter === 'Semua')
        return true;
    const startMs = parseTime(item.startsAt) ?? parseTime(window.startIso) ?? 0;
    const endMs = parseTime(item.endsAt) ?? parseTime(window.endIso) ?? Infinity;
    return filter === 'Berlangsung' ? now >= startMs && now < endMs : startMs > now;
}
