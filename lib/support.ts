export const SUPPORT_MESSAGE_MAX = 2000;
export const APPEAL_CODE_LENGTH = 12;
export const APPEAL_CODE_PREFIX = 'RB';
export type AppealStatus = 'pending' | 'reviewing' | 'approved' | 'rejected';
export function normalizeSupportEmail(raw: string | null | undefined): string {
    return (raw ?? '').trim().toLowerCase();
}
export function isValidSupportEmail(raw: string | null | undefined): boolean {
    const email = normalizeSupportEmail(raw);
    if (email.length < 3 || email.length > 254)
        return false;
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}
export function escapeLikePattern(raw: string): string {
    return raw.replace(/[\\%_]/g, (char) => `\\${char}`);
}
export function sanitizeSupportSearch(raw: string | null | undefined): string {
    return (raw ?? '')
        .trim()
        .replace(/[,()%_\\]/g, '')
        .replace(/\s+/g, ' ')
        .slice(0, 80);
}
export function normalizeAppealCode(raw: string | null | undefined): string {
    const cleaned = (raw ?? '')
        .toUpperCase()
        .replace(/[^0-9A-Z]/g, '');
    if (cleaned.length > APPEAL_CODE_LENGTH && cleaned.startsWith(APPEAL_CODE_PREFIX)) {
        return cleaned.slice(APPEAL_CODE_PREFIX.length);
    }
    return cleaned;
}
export function isPlausibleAppealCode(raw: string | null | undefined): boolean {
    const code = normalizeAppealCode(raw);
    return new RegExp(`^[0-9A-F]{${APPEAL_CODE_LENGTH}}$`).test(code);
}
export function formatAppealCode(raw: string | null | undefined): string {
    const code = normalizeAppealCode(raw);
    if (code.length !== APPEAL_CODE_LENGTH)
        return code;
    const groups = code.match(/.{1,4}/g) ?? [];
    return `${APPEAL_CODE_PREFIX}-${groups.join('-')}`;
}
export interface AppealStatusMeta {
    label: string;
    variant: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';
    hint: string;
}
const APPEAL_STATUS_META: Record<AppealStatus, AppealStatusMeta> = {
    pending: {
        label: 'Menunggu ditinjau',
        variant: 'warning',
        hint: 'Banding sudah diterima dan menunggu dibaca admin. Tidak perlu mengirim ulang.',
    },
    reviewing: {
        label: 'Sedang ditinjau',
        variant: 'outline',
        hint: 'Admin sedang memeriksa banding ini. Kamu bisa menambah keterangan lewat kotak di bawah.',
    },
    approved: {
        label: 'Disetujui',
        variant: 'success',
        hint: 'Banding diterima dan blokir dibuka. Coba masuk kembali ke ReBites sekarang.',
    },
    rejected: {
        label: 'Ditolak',
        variant: 'destructive',
        hint: 'Banding ditolak. Alasan admin tertulis di bawah.',
    },
};
export function appealStatusMeta(status: string | null | undefined): AppealStatusMeta {
    const key = (status ?? '').trim().toLowerCase() as AppealStatus;
    if (key in APPEAL_STATUS_META)
        return APPEAL_STATUS_META[key];
    return {
        label: status?.trim() ? status.trim() : 'Status tidak diketahui',
        variant: 'secondary',
        hint: 'Status ini belum dikenali aplikasi. Hubungi admin bila perlu kepastian.',
    };
}
export function supportSenderLabel(kind: string | null | undefined): string {
    switch ((kind ?? '').trim().toLowerCase()) {
        case 'admin':
            return 'Admin ReBites';
        case 'system':
            return 'Sistem ReBites';
        default:
            return 'Pengguna';
    }
}
