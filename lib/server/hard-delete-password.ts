import { createHash, timingSafeEqual } from 'node:crypto';
export const HARD_DELETE_PASSWORD_ENV = 'PASSWORD_DELETE_USER';
export const HARD_DELETE_UNCONFIGURED_MESSAGE = 'Fitur hapus permanen belum diaktifkan di server. Isi PASSWORD_DELETE_USER lalu coba lagi.';
export const HARD_DELETE_PASSWORD_MISMATCH_MESSAGE = 'Sandi konfirmasi salah.';
export function readHardDeletePassword(env: Record<string, string | undefined> = process.env): string {
    const value = env[HARD_DELETE_PASSWORD_ENV];
    return typeof value === 'string' ? value : '';
}
export function isHardDeleteConfigured(env: Record<string, string | undefined> = process.env): boolean {
    return readHardDeletePassword(env).trim() !== '';
}
export function isHardDeletePasswordValid(input: unknown, expected: unknown): boolean {
    if (typeof input !== 'string' || typeof expected !== 'string')
        return false;
    if (input === '' || expected === '')
        return false;
    const a = createHash('sha256').update(input, 'utf8').digest();
    const b = createHash('sha256').update(expected, 'utf8').digest();
    return timingSafeEqual(a, b);
}
