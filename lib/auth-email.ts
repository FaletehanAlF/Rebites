'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isSafeInternalPath } from './safe-path';
import { BLOCKED_ACCOUNT_MESSAGE, isBannedAuthError } from './account-block';
export function isSafeNextPath(path: string | null | undefined): path is string {
    return isSafeInternalPath(path);
}
function getBrowserOrigin(): string | null {
    if (typeof window !== 'undefined' && window.location?.origin) {
        return window.location.origin.replace(/\/$/, '');
    }
    return null;
}
function getEnvSiteUrl(): string | null {
    const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, '');
    return raw ? raw : null;
}
export function getSiteOrigin(): string {
    return getBrowserOrigin() ?? getEnvSiteUrl() ?? 'http://localhost:3000';
}
export function getAuthCallbackUrl(nextPath?: string | null): string {
    const base = `${getSiteOrigin()}/auth/callback`;
    if (isSafeNextPath(nextPath)) {
        return `${base}?next=${encodeURIComponent(nextPath)}`;
    }
    return base;
}
export function getDesiredNextPath(search: string, fallback: string): string {
    try {
        const params = new URLSearchParams(search);
        const explicitNext = params.get('next');
        if (isSafeNextPath(explicitNext))
            return explicitNext;
        const rawRedirect = params.get('redirect');
        if (isSafeNextPath(rawRedirect))
            return rawRedirect;
        const planParam = params.get('plan');
        if (planParam === 'basic' ||
            planParam === 'standar' ||
            planParam === 'premium') {
            const billingParam = params.get('billing');
            const billing = billingParam === 'yearly' ? 'yearly' : 'monthly';
            return `/auth/register/penjual?plan=${planParam}&billing=${billing}`;
        }
    }
    catch {
    }
    return isSafeNextPath(fallback) ? fallback : '/home';
}
export interface FriendlyAuthError {
    message: string;
    isRateLimited: boolean;
    isAlreadyConfirmed: boolean;
}
export const EMAIL_COOLDOWN_SECONDS = 60;
export function parseCooldownSeconds(rawMessage: string): number | null {
    const match = /after\s+(\d+)\s*seconds?/i.exec(rawMessage || '');
    if (!match)
        return null;
    const seconds = Number(match[1]);
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 3600)
        return null;
    return Math.ceil(seconds);
}
export function isEmailRateLimitError(rawMessage: string): boolean {
    const msg = (rawMessage || '').toLowerCase();
    return (msg.includes('rate limit') ||
        msg.includes('over_email_send_rate_limit') ||
        msg.includes('over_sms_send_rate_limit') ||
        msg.includes('for security purposes') ||
        msg.includes('only request this after') ||
        msg.includes('too many') ||
        msg.includes('429'));
}
export const EMAIL_DELIVERY_ERROR_MESSAGE = 'Email belum bisa dikirim oleh server ReBites saat ini. Coba lagi beberapa menit lagi. Bila masih gagal, hubungi halo@rebites.id.';
export function isEmailDeliveryError(rawMessage: string): boolean {
    const msg = (rawMessage || '').toLowerCase();
    if (!msg)
        return false;
    return (msg.includes('error sending') ||
        msg.includes('email address not authorized') ||
        msg.includes('smtp') ||
        msg.includes('domain is not verified') ||
        msg.includes('domain not verified') ||
        msg.includes('verify a domain') ||
        msg.includes('testing emails') ||
        msg.includes('own email address'));
}
export function useEmailCooldown(defaultSeconds: number = EMAIL_COOLDOWN_SECONDS) {
    const [cooldownUntil, setCooldownUntil] = useState(0);
    const [nowMs, setNowMs] = useState(() => Date.now());
    const timerRef = useRef<number | null>(null);
    useEffect(() => {
        return () => {
            if (timerRef.current !== null) {
                window.clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, []);
    const start = useCallback((seconds?: number) => {
        const duration = seconds ?? defaultSeconds;
        if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }
        setCooldownUntil(Date.now() + Math.max(1, duration) * 1000);
        setNowMs(Date.now());
        timerRef.current = window.setInterval(() => {
            setNowMs(Date.now());
        }, 1000);
    }, [defaultSeconds]);
    useEffect(() => {
        if (cooldownUntil > 0 &&
            nowMs >= cooldownUntil &&
            timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, [nowMs, cooldownUntil]);
    const remainingSec = cooldownUntil > nowMs ? Math.ceil((cooldownUntil - nowMs) / 1000) : 0;
    return {
        cooldownUntil,
        remainingSec,
        isCooling: remainingSec > 0,
        start,
    };
}
export function mapResendError(rawMessage: string): FriendlyAuthError {
    if (isEmailRateLimitError(rawMessage)) {
        return {
            message: 'Terlalu sering meminta email. Tunggu sekitar 1 menit, cek folder spam/promosi, lalu coba kirim ulang.',
            isRateLimited: true,
            isAlreadyConfirmed: false,
        };
    }
    if (isEmailDeliveryError(rawMessage)) {
        return {
            message: EMAIL_DELIVERY_ERROR_MESSAGE,
            isRateLimited: false,
            isAlreadyConfirmed: false,
        };
    }
    const lower = (rawMessage || '').toLowerCase();
    const isAlreadyConfirmed = lower.includes('already confirmed') ||
        lower.includes('already registered') ||
        lower.includes('user already confirmed') ||
        lower.includes('email already confirmed');
    if (isAlreadyConfirmed) {
        return {
            message: 'Email ini sudah terverifikasi. Silakan masuk.',
            isRateLimited: false,
            isAlreadyConfirmed: true,
        };
    }
    if (!rawMessage) {
        return {
            message: 'Gagal mengirim ulang email. Silakan coba lagi.',
            isRateLimited: false,
            isAlreadyConfirmed: false,
        };
    }
    return { message: rawMessage, isRateLimited: false, isAlreadyConfirmed: false };
}
export function mapCallbackError(rawMessage: string): string {
    const msg = (rawMessage || '').toLowerCase();
    if (!msg)
        return 'Tautan verifikasi tidak valid atau sudah kedaluwarsa.';
    if (isBannedAuthError(rawMessage))
        return BLOCKED_ACCOUNT_MESSAGE;
    if (msg.includes('expired') ||
        msg.includes('token has expired') ||
        msg.includes('otp expired')) {
        return 'Tautan sudah kedaluwarsa. Minta tautan baru lewat kirim ulang email konfirmasi, lalu klik dalam 5 menit.';
    }
    if (msg.includes('code verifier') ||
        msg.includes('pkce') ||
        msg.includes('different browser') ||
        msg.includes('different device')) {
        return 'Tautan dibuka di browser/perangkat berbeda sehingga tidak bisa ditukar otomatis. Buka tautan di browser yang sama saat mendaftar, atau minta tautan baru dan buka di perangkat yang sama.';
    }
    if (msg.includes('already used') ||
        msg.includes('already confirmed') ||
        msg.includes('token has been used')) {
        return 'Tautan sudah pernah dipakai. Email kemungkinan sudah terverifikasi — silakan masuk. Bila masih ditolak, kirim ulang email konfirmasi.';
    }
    if (msg.includes('access_denied') || msg.includes('denied')) {
        return 'Verifikasi ditolak. Coba kirim ulang email konfirmasi dan klik tautan terbaru.';
    }
    return rawMessage;
}
export function mapOtpVerifyError(rawMessage: string): string {
    const msg = (rawMessage || '').toLowerCase();
    if (isBannedAuthError(rawMessage))
        return BLOCKED_ACCOUNT_MESSAGE;
    if (isEmailRateLimitError(rawMessage)) {
        return 'Terlalu banyak percobaan verifikasi. Tunggu sekitar 1 menit, lalu coba lagi dengan kode terbaru.';
    }
    const mentionsExpired = msg.includes('expired');
    const mentionsInvalid = msg.includes('invalid') ||
        msg.includes('incorrect') ||
        msg.includes('otp') ||
        msg.includes('token');
    if (mentionsExpired && mentionsInvalid) {
        return 'Kode salah atau sudah kedaluwarsa. Periksa kembali kode terbaru di email, atau kirim ulang kode baru.';
    }
    if (mentionsExpired) {
        return 'Kode sudah kedaluwarsa. Kirim ulang kode baru, lalu masukkan kode terbaru dari email.';
    }
    if (mentionsInvalid) {
        return 'Kode verifikasi salah. Periksa kembali kode terbaru di email, atau kirim ulang kode baru.';
    }
    if (!msg) {
        return 'Kode verifikasi tidak dapat diproses. Periksa kembali kode dari email.';
    }
    return 'Kode verifikasi tidak dapat diverifikasi. Periksa kembali kode terbaru di email, atau kirim ulang kode baru.';
}
