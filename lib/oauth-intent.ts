export const OAUTH_INTENT_PARAM = 'intent';
export const OAUTH_INTENT_REGISTER = 'register';
export const OAUTH_INTENT_LOGIN = 'login';
export type OAuthIntent = typeof OAUTH_INTENT_REGISTER | typeof OAUTH_INTENT_LOGIN;
export function getOAuthIntent(search: string): OAuthIntent | null {
    try {
        const value = new URLSearchParams(search).get(OAUTH_INTENT_PARAM);
        return value === OAUTH_INTENT_REGISTER || value === OAUTH_INTENT_LOGIN
            ? value
            : null;
    }
    catch {
        return null;
    }
}
export const REGISTER_GOOGLE_EXISTS_MESSAGE = 'Email sudah terdaftar. Silakan login menggunakan Google.';
export const REGISTER_INTENT_GRACE_MS = 30 * 1000;
export interface OAuthUserTimestamps {
    created_at?: string | null;
    last_sign_in_at?: string | null;
}
export function isReturningOAuthUser(user: OAuthUserTimestamps | null | undefined): boolean {
    const created = Date.parse(user?.created_at ?? '');
    const last = Date.parse(user?.last_sign_in_at ?? '');
    if (!Number.isFinite(created) || !Number.isFinite(last))
        return false;
    return Math.abs(last - created) > REGISTER_INTENT_GRACE_MS;
}
