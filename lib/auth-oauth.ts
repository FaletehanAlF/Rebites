'use client';
import { getSiteOrigin, isSafeNextPath } from './auth-email';
import { isSafeInternalPath } from './safe-path';
import { BLOCKED_ACCOUNT_MESSAGE, isBannedAuthError } from './account-block';
import { OAUTH_INTENT_LOGIN, OAUTH_INTENT_PARAM, OAUTH_INTENT_REGISTER, type OAuthIntent, } from './oauth-intent';
export const OAUTH_CALLBACK_PARAM = 'oauth';
export const OAUTH_CALLBACK_VALUE = 'google';
export { OAUTH_INTENT_PARAM, OAUTH_INTENT_REGISTER, OAUTH_INTENT_LOGIN, getOAuthIntent, isReturningOAuthUser, REGISTER_GOOGLE_EXISTS_MESSAGE, REGISTER_INTENT_GRACE_MS, type OAuthIntent, type OAuthUserTimestamps, } from './oauth-intent';
export function getExplicitNextPath(search: string): string | null {
    try {
        const params = new URLSearchParams(search);
        const next = params.get('next');
        if (isSafeNextPath(next))
            return next;
        const redirect = params.get('redirect');
        if (isSafeNextPath(redirect))
            return redirect;
    }
    catch {
    }
    return null;
}
export function getOAuthCallbackUrl(nextPath?: string | null, intent?: OAuthIntent | null): string {
    const params = new URLSearchParams({
        [OAUTH_CALLBACK_PARAM]: OAUTH_CALLBACK_VALUE,
    });
    if (isSafeInternalPath(nextPath)) {
        params.set('next', nextPath);
    }
    if (intent === OAUTH_INTENT_REGISTER || intent === OAUTH_INTENT_LOGIN) {
        params.set(OAUTH_INTENT_PARAM, intent);
    }
    return `${getSiteOrigin()}/auth/callback?${params.toString()}`;
}
export function isOAuthCallback(search: string): boolean {
    try {
        const params = new URLSearchParams(search);
        return params.get(OAUTH_CALLBACK_PARAM) === OAUTH_CALLBACK_VALUE;
    }
    catch {
        return false;
    }
}
export function mapOAuthError(rawMessage: string): string {
    const msg = (rawMessage || '').toLowerCase();
    if (!msg) {
        return 'Masuk dengan Google gagal. Silakan coba lagi, atau masuk dengan email dan kata sandi.';
    }
    if (isBannedAuthError(rawMessage))
        return BLOCKED_ACCOUNT_MESSAGE;
    if (msg.includes('access_denied') ||
        msg.includes('access denied') ||
        msg.includes('cancel') ||
        msg.includes('denied')) {
        return 'Masuk dengan Google dibatalkan. Kamu bisa mencoba lagi atau masuk dengan email dan kata sandi.';
    }
    if (msg.includes('email_exists') ||
        msg.includes('already registered') ||
        msg.includes('already linked') ||
        msg.includes('identity is already') ||
        msg.includes('linked to another user')) {
        return 'Email Google ini sudah terdaftar di ReBites dengan kata sandi. Masuk menggunakan email dan kata sandi tersebut, atau gunakan akun Google dengan email lain.';
    }
    if (msg.includes('provider is not enabled') ||
        msg.includes('unsupported provider') ||
        msg.includes('validation_failed')) {
        return 'Masuk dengan Google belum tersedia saat ini. Silakan masuk dengan email dan kata sandi.';
    }
    if (msg.includes('redirect') ||
        msg.includes('redirect_uri_mismatch') ||
        msg.includes('invalid request')) {
        return 'Masuk dengan Google belum bisa diselesaikan karena pengalihan tidak dikenali. Coba lagi, atau masuk dengan email dan kata sandi. Bila berulang, hubungi halo@rebites.id.';
    }
    if (msg.includes('code verifier') || msg.includes('pkce') || msg.includes('flow_state')) {
        return 'Proses Google tidak bisa dilanjutkan di browser ini. Ulangi masuk dengan Google dari awal di browser yang sama.';
    }
    if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('429')) {
        return 'Terlalu banyak percobaan masuk. Tunggu sekitar 1 menit, lalu coba lagi.';
    }
    return 'Masuk dengan Google gagal. Silakan coba lagi, atau masuk dengan email dan kata sandi.';
}
