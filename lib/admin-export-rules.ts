import { wibDayKey } from './wib-time.ts';
export const ADMIN_EXPORT_MAX_ROWS = 5000;
export const ADMIN_EXPORT_ID_CHUNK = 200;
export function adminExportFilename(kind: string, now: number = Date.now()): string {
    return `${kind}-rebites-${wibDayKey(now) ?? 'tanpa-tanggal'}.xlsx`;
}
export function adminExportLimitMessage(noun: string, total: number): string {
    return `Jumlah ${noun} (${total.toLocaleString('id-ID')}) melebihi batas ekspor ${ADMIN_EXPORT_MAX_ROWS.toLocaleString('id-ID')} baris. Persempit filter lebih dulu.`;
}
export function chunkValues<T>(values: readonly T[], size: number): T[][] {
    const normalized = Number.isFinite(size) ? Math.max(1, Math.floor(size)) : 1;
    const chunks: T[][] = [];
    for (let index = 0; index < values.length; index += normalized) {
        chunks.push(values.slice(index, index + normalized));
    }
    return chunks;
}
export interface ChunkedRowsResult<T> {
    rows: T[];
    error: unknown | null;
}
export async function fetchRowsInChunks<T>(ids: readonly string[], size: number, fetchChunk: (chunk: string[]) => PromiseLike<{
    data: unknown;
    error: unknown;
}>): Promise<ChunkedRowsResult<T>> {
    const rows: T[] = [];
    for (const chunk of chunkValues(ids, size)) {
        const result = await fetchChunk(chunk);
        if (result.error)
            return { rows, error: result.error };
        rows.push(...((result.data ?? []) as T[]));
    }
    return { rows, error: null };
}
