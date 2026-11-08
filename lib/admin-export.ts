'use client';
import { fetchAdminWithAuth } from './admin-auth';
import { AuthError } from './auth-token';
import { contentDispositionFilename, isXlsxContentType } from './csv';
export interface AdminExportResult {
    downloaded: boolean;
    rows: number;
    filename: string | null;
}
export class AdminExportApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.name = 'AdminExportApiError';
        this.status = status;
    }
}
export interface DownloadAdminExportOptions {
    url: string;
    signal?: AbortSignal;
    fallbackMessage?: string;
}
export async function downloadAdminExport({ url, signal, fallbackMessage = 'Gagal membuat ekspor.', }: DownloadAdminExportOptions): Promise<AdminExportResult> {
    let res: Response;
    try {
        res = await fetchAdminWithAuth(url, { cache: 'no-store', signal });
    }
    catch (err) {
        if (err instanceof AuthError) {
            throw new AdminExportApiError(err.message, err.status);
        }
        throw err;
    }
    if (res.status === 204) {
        return { downloaded: false, rows: 0, filename: null };
    }
    if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
            error?: string;
        } | null;
        throw new AdminExportApiError(json?.error ?? fallbackMessage, res.status);
    }
    if (!isXlsxContentType(res.headers.get('Content-Type'))) {
        throw new AdminExportApiError('Respons ekspor bukan berkas Excel yang valid.', 502);
    }
    const blob = await res.blob();
    if (blob.size === 0) {
        throw new AdminExportApiError('File Excel kosong; ekspor dibatalkan.', 500);
    }
    if (signal?.aborted) {
        const aborted = new Error('Ekspor dibatalkan karena filter berubah.');
        aborted.name = 'AbortError';
        throw aborted;
    }
    const filename = contentDispositionFilename(res.headers.get('Content-Disposition'));
    const rawRows = Number(res.headers.get('X-Export-Row-Count') ?? '0');
    const rows = Number.isFinite(rawRows) && rawRows >= 0 ? rawRows : 0;
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename ?? 'ekspor-rebites.xlsx';
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    return { downloaded: true, rows, filename };
}
export function isAbortError(err: unknown): boolean {
    return (err as {
        name?: string;
    } | null)?.name === 'AbortError';
}
