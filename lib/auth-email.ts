'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isSafeInternalPath } from './safe-path';

/**
 * Helper bersama untuk URL callback + resend konfirmasi email (buyer & seller).
 *
 * Latar belakang:
 * - `NEXT_PUBLIC_SITE_URL` di-inline saat build, sehingga nilai build-time
 *   bisa basi (localhost vs vercel, http vs https). Di browser, sumber
 *   kebenaran terbaik adalah `window.location.origin` saat itu.
 * - Signup memakai `emailRedirectTo` -> Supabase mengirim link konfirmasi
 *   ke `/auth/callback`, yang kemudian menukar `code` / verifikasi
 *   `token_hash`. `next` di dalam callback menentukan tujuan akhir
 *   (mis. onboarding penjual bila user daftar via paket).
 */

/**
 * Validasi path `next` internal.
 * Implementasi tunggal ada di lib/safe-path.ts (menolak '//', backslash,
 * karakter kontrol, dan varian terenkodenya) — wrapper ini dipertahankan
 * agar import lama tidak pecah.
 */
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

/** Origin yang dipakai untuk membangun URL callback. Prioritas: browser > env > localhost. */
export function getSiteOrigin(): string {
  return getBrowserOrigin() ?? getEnvSiteUrl() ?? 'http://localhost:3000';
}

/**
 * Bangun URL absolut `/auth/callback` dengan `?next=` opsional.
 * `nextPath` yang tidak aman diabaikan (fallback tanpa param).
 */
export function getAuthCallbackUrl(nextPath?: string | null): string {
  const base = `${getSiteOrigin()}/auth/callback`;
  if (isSafeNextPath(nextPath)) {
    return `${base}?next=${encodeURIComponent(nextPath)}`;
  }
  return base;
}

/**
 * Tentukan tujuan akhir setelah verifikasi/login dari query string halaman
 * auth saat ini. Meniru logika redirect `AuthForm` agar link email
 * mengembalikan user ke tempat yang benar (mis. `/auth/register/penjual?plan=...`).
 */
export function getDesiredNextPath(
  search: string,
  fallback: string
): string {
  try {
    const params = new URLSearchParams(search);
    // `next` eksplisit (dipakai forgot-password & callback) diprioritaskan.
    const explicitNext = params.get('next');
    if (isSafeNextPath(explicitNext)) return explicitNext;

    const rawRedirect = params.get('redirect');
    if (isSafeNextPath(rawRedirect)) return rawRedirect;

    const planParam = params.get('plan');
    if (
      planParam === 'basic' ||
      planParam === 'standar' ||
      planParam === 'premium'
    ) {
      const billingParam = params.get('billing');
      const billing = billingParam === 'yearly' ? 'yearly' : 'monthly';
      return `/auth/register/penjual?plan=${planParam}&billing=${billing}`;
    }
  } catch {
    // Abaikan parse error, pakai fallback.
  }
  return isSafeNextPath(fallback) ? fallback : '/home';
}

export interface FriendlyAuthError {
  message: string;
  isRateLimited: boolean;
  isAlreadyConfirmed: boolean;
}

/** Cooldown default pengiriman email autentikasi (detik). Proteksi UX saja. */
export const EMAIL_COOLDOWN_SECONDS = 60;

/**
 * Ambil durasi cooldown (detik) dari pesan error Supabase bila pesannya
 * menyediakannya secara eksplisit (mis. "...after 58 seconds").
 * Kembalikan null bila tidak ada info durasi yang dapat dipercaya —
 * caller WAJIB memakai default dan TIDAK mengarang angka.
 */
export function parseCooldownSeconds(rawMessage: string): number | null {
  const match = /after\s+(\d+)\s*seconds?/i.exec(rawMessage || '');
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 3600) return null;
  return Math.ceil(seconds);
}

/** Deteksi error rate limit email dari pesan mentah Supabase. */
export function isEmailRateLimitError(rawMessage: string): boolean {
  const msg = (rawMessage || '').toLowerCase();
  return (
    msg.includes('rate limit') ||
    msg.includes('over_email_send_rate_limit') ||
    msg.includes('over_sms_send_rate_limit') ||
    msg.includes('for security purposes') ||
    msg.includes('only request this after') ||
    msg.includes('too many') ||
    msg.includes('429')
  );
}

/**
 * Pesan ramah untuk kegagalan PENGIRIMAN email (respon Supabase "Error sending
 * confirmation/recovery email", SMTP ditolak, domain pengirim belum
 * diverifikasi, atau batasan akun testing penyedia email).
 *
 * Dipakai bersama oleh register, kirim ulang verifikasi, dan forgot password
 * supaya kegagalan konfigurasi pengiriman TIDAK tampil sebagai pesan teknis
 * berbahasa Inggris di UI. Pesan ini sengaja tidak memuat detail internal
 * (host SMTP, kode status, alamat pengirim, atau pesan penyedia) agar tidak
 * membocorkan informasi sensitif ke pengguna.
 */
export const EMAIL_DELIVERY_ERROR_MESSAGE =
  'Email belum bisa dikirim oleh server ReBites saat ini. Coba lagi beberapa menit lagi. Bila masih gagal, hubungi halo@rebites.id.';

/**
 * Deteksi kegagalan pengiriman email dari pesan mentah Supabase Auth.
 * Pencocokan memakai frasa yang benar-benar muncul pada error Supabase maupun
 * penolakan penyedia SMTP; tidak ada asumsi soal bahasa pesan lain.
 */
export function isEmailDeliveryError(rawMessage: string): boolean {
  const msg = (rawMessage || '').toLowerCase();
  if (!msg) return false;
  return (
    msg.includes('error sending') ||
    msg.includes('email address not authorized') ||
    msg.includes('smtp') ||
    msg.includes('domain is not verified') ||
    msg.includes('domain not verified') ||
    msg.includes('verify a domain') ||
    msg.includes('testing emails') ||
    msg.includes('own email address')
  );
}

/**
 * Cooldown UX pengiriman email autentikasi (forgot password / resend).
 *
 * - `start(seconds?)` mengunci pengiriman selama N detik (default 60).
 * - `remainingSec` / `isCooling` reaktif per detik agar countdown konsisten
 *   saat render ulang.
 * - Interval dibersihkan saat cooldown selesai DAN saat komponen dilepas
 *   (tidak ada timer bocor).
 * - Ini BUKAN pengaman keamanan: rate limit server Supabase tetap berlaku.
 */
export function useEmailCooldown(
  defaultSeconds: number = EMAIL_COOLDOWN_SECONDS
) {
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const timerRef = useRef<number | null>(null);

  // Bersihkan interval saat komponen dilepas.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const start = useCallback(
    (seconds?: number) => {
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
    },
    [defaultSeconds]
  );

  // Hentikan interval setelah cooldown selesai.
  useEffect(() => {
    if (
      cooldownUntil > 0 &&
      nowMs >= cooldownUntil &&
      timerRef.current !== null
    ) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [nowMs, cooldownUntil]);

  const remainingSec =
    cooldownUntil > nowMs ? Math.ceil((cooldownUntil - nowMs) / 1000) : 0;
  return {
    cooldownUntil,
    remainingSec,
    isCooling: remainingSec > 0,
    start,
  };
}

/** Petakan error mentah Supabase Auth menjadi pesan Indonesia yang ramah. */
export function mapResendError(rawMessage: string): FriendlyAuthError {
  if (isEmailRateLimitError(rawMessage)) {
    return {
      message:
        'Terlalu sering meminta email. Tunggu sekitar 1 menit, cek folder spam/promosi, lalu coba kirim ulang.',
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
  const isAlreadyConfirmed =
    lower.includes('already confirmed') ||
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

/** Petakan error callback (`?error_description=` / pesan verify) menjadi pesan Indonesia. */
export function mapCallbackError(rawMessage: string): string {
  const msg = (rawMessage || '').toLowerCase();
  if (!msg) return 'Tautan verifikasi tidak valid atau sudah kedaluwarsa.';
  if (
    msg.includes('expired') ||
    msg.includes('token has expired') ||
    msg.includes('otp expired')
  ) {
    return 'Tautan sudah kedaluwarsa. Minta tautan baru lewat kirim ulang email konfirmasi, lalu klik dalam 5 menit.';
  }
  if (
    msg.includes('code verifier') ||
    msg.includes('pkce') ||
    msg.includes('different browser') ||
    msg.includes('different device')
  ) {
    return 'Tautan dibuka di browser/perangkat berbeda sehingga tidak bisa ditukar otomatis. Buka tautan di browser yang sama saat mendaftar, atau minta tautan baru dan buka di perangkat yang sama.';
  }
  if (
    msg.includes('already used') ||
    msg.includes('already confirmed') ||
    msg.includes('token has been used')
  ) {
    return 'Tautan sudah pernah dipakai. Email kemungkinan sudah terverifikasi — silakan masuk. Bila masih ditolak, kirim ulang email konfirmasi.';
  }
  if (msg.includes('access_denied') || msg.includes('denied')) {
    return 'Verifikasi ditolak. Coba kirim ulang email konfirmasi dan klik tautan terbaru.';
  }
  return rawMessage;
}

/**
 * Petakan error `supabase.auth.verifyOtp` untuk kode OTP email menjadi pesan
 * Indonesia yang ramah. Supabase sering menggabungkan kode salah dan kode
 * kedaluwarsa dalam satu pesan ("Token has expired or is invalid"), jadi
 * kasus itu dijelaskan dalam satu kalimat.
 */
export function mapOtpVerifyError(rawMessage: string): string {
  const msg = (rawMessage || '').toLowerCase();
  if (isEmailRateLimitError(rawMessage)) {
    return 'Terlalu banyak percobaan verifikasi. Tunggu sekitar 1 menit, lalu coba lagi dengan kode terbaru.';
  }
  const mentionsExpired = msg.includes('expired');
  const mentionsInvalid =
    msg.includes('invalid') ||
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
