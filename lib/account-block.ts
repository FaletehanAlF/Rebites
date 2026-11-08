export type AccountBlockKind = 'banned' | 'suspended';
export const BLOCKED_ACCOUNT_MESSAGE = 'Akun Anda telah diblokir oleh admin ReBites, sehingga Anda tidak dapat masuk. Hubungi admin ReBites bila menurut Anda ini keliru.';
export const SUSPENDED_ACCOUNT_MESSAGE = 'Akun Anda sedang ditangguhkan oleh admin ReBites, sehingga sementara tidak dapat masuk. Hubungi admin ReBites bila menurut Anda ini keliru.';
export function blockMessageFor(kind: AccountBlockKind): string {
    return kind === 'banned' ? BLOCKED_ACCOUNT_MESSAGE : SUSPENDED_ACCOUNT_MESSAGE;
}
export function isAccountBlockMessage(message: string | null | undefined): boolean {
    const value = (message ?? '').trim();
    return value === BLOCKED_ACCOUNT_MESSAGE || value === SUSPENDED_ACCOUNT_MESSAGE;
}
export function classifyAccountBlock(rowOrStatus: unknown): AccountBlockKind | null {
    let raw: unknown = rowOrStatus;
    if (typeof rowOrStatus === 'object' && rowOrStatus !== null) {
        raw = (rowOrStatus as {
            account_status?: unknown;
        }).account_status;
    }
    if (typeof raw !== 'string')
        return null;
    const status = raw.trim().toLowerCase();
    if (status === 'banned')
        return 'banned';
    if (status === 'suspended')
        return 'suspended';
    return null;
}
export function isBannedAuthError(error: unknown): boolean {
    if (error === null || error === undefined)
        return false;
    if (typeof error === 'string')
        return looksBanned(error);
    if (typeof error === 'object') {
        const source = error as {
            code?: unknown;
            error_code?: unknown;
            message?: unknown;
            error_description?: unknown;
        };
        for (const value of [
            source.code,
            source.error_code,
            source.message,
            source.error_description,
        ]) {
            if (typeof value === 'string' && looksBanned(value))
                return true;
        }
    }
    return false;
}
export function isBlockedRoleErrorCode(code: unknown): boolean {
    return (code === 'account-deleted' || code === 'account-suspended' || code === 'account-banned');
}
function looksBanned(text: string): boolean {
    const value = text.toLowerCase();
    return value.includes('user_banned') || /\bbanned\b/.test(value);
}
export function isActiveBlockSanction(row: {
    sanctionType?: unknown;
    endAt?: unknown;
} | null | undefined, nowMs: number): boolean {
    if (!row)
        return false;
    const type = typeof row.sanctionType === 'string' ? row.sanctionType.trim().toLowerCase() : '';
    if (type !== 'suspend' && type !== 'ban')
        return false;
    const endAt = row.endAt;
    if (endAt === null || endAt === undefined)
        return true;
    if (typeof endAt !== 'string')
        return true;
    const ms = Date.parse(endAt);
    if (!Number.isFinite(ms))
        return true;
    return ms > nowMs;
}
