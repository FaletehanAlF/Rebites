export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;
function toEpoch(value: Date | number | string): number | null {
    const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
}
export function startOfDayWib(input: Date | number | string = Date.now()): number {
    const ms = toEpoch(input);
    if (ms === null)
        return Number.NaN;
    const shifted = new Date(ms + WIB_OFFSET_MS);
    return (Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) -
        WIB_OFFSET_MS);
}
export function startOfDaysWindowWib(days: number, now: Date | number = Date.now()): number {
    const normalizedDays = Number.isFinite(days) ? Math.max(1, Math.floor(days)) : 1;
    return startOfDayWib(now) - (normalizedDays - 1) * DAY_MS;
}
export function wibDayKey(iso: string | number | Date): string | null {
    const ms = toEpoch(iso);
    if (ms === null)
        return null;
    return new Date(ms + WIB_OFFSET_MS).toISOString().slice(0, 10);
}
export function formatWibDateOnly(input: Date | number | string = Date.now()): string | null {
    return wibDayKey(input);
}
export function formatWibDateTime(input: Date | number | string): string | null {
    const ms = toEpoch(input);
    if (ms === null)
        return null;
    return new Date(ms + WIB_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ');
}
export function parseWibDateOnly(raw: string): number | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw))
        return null;
    const ms = new Date(`${raw}T00:00:00+07:00`).getTime();
    if (!Number.isFinite(ms))
        return null;
    return wibDayKey(ms) === raw ? ms : null;
}
