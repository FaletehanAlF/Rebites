export const DELETED_ACCOUNT_MESSAGE = 'Akun ini sudah dihapus oleh admin. Hubungi admin ReBites bila menurut Anda ini keliru.';
export function isAccountDeleted(row: unknown): boolean {
    if (typeof row !== 'object' || row === null)
        return false;
    const value = (row as {
        deleted_at?: unknown;
    }).deleted_at;
    if (value === null || value === undefined)
        return false;
    if (typeof value === 'string')
        return value.trim() !== '';
    return true;
}
export function isStoreDeleted(row: unknown): boolean {
    return isAccountDeleted(row);
}
