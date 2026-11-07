export type AdminMeStatus = 'loading' | 'verified' | 'unverified' | 'error';
export type AdminMeFailureStatus = Exclude<AdminMeStatus, 'loading' | 'verified'>;
export interface AdminMeFailure {
    status: AdminMeFailureStatus;
    message: string | null;
}
export const ADMIN_ME_ERROR_MESSAGE = 'Tidak dapat memeriksa status admin. Periksa koneksi internet lalu coba lagi.';
export function classifyAdminMeFailure(error: unknown): AdminMeFailure {
    const raw = (error as {
        status?: unknown;
    } | null)?.status;
    const status = typeof raw === 'number' ? raw : 0;
    if (status === 401 || status === 403) {
        return { status: 'unverified', message: null };
    }
    return { status: 'error', message: ADMIN_ME_ERROR_MESSAGE };
}
