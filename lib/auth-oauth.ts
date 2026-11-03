'use client';

/**
 * Helper Google OAuth (khusus alur pembeli).
 *
 * Prinsip:
 * - Satu sumber URL callback tetap `lib/auth-email.ts` (`getSiteOrigin`),
 *   sehingga origin mengikuti browser saat itu (localhost:3000, localhost:3001,
 *   atau domain produksi) tanpa hardcode.
 * - Callback email/OTP TIDAK memakai penanda ini. Hanya login Google yang
 *   mengirim `?oauth=google`, sehingga perilaku verifikasi email tetap utuh.
 * - `next` tetap divalidasi `lib/safe-path.ts` sebelum dipakai.
 */

import { getSiteOrigin, isSafeNextPath } from './auth-email';
import { isSafeInternalPath } from './safe-path';

/** Nilai penanda `?oauth=` yang dikenali callback. */
export const OAUTH_CALLBACK_PARAM = 'oauth';
export const OAUTH_CALLBACK_VALUE = 'google';

/**
 * Ambil tujuan akhir yang diminta SECARA EKSPLISIT dari query halaman auth
 * (`?next=` atau `?redirect=`).
 *
 * Sengaja TIDAK memakai fallback default halaman (mis. `/home`): bila tidak ada
 * permintaan eksplisit, callback menentukan tujuan dari role akun
 * (buyer → /home, umkm → /dashboard/penjual, admin → /dashboard/admin).
 */
export function getExplicitNextPath(search: string): string | null {
  try {
    const params = new URLSearchParams(search);
    const next = params.get('next');
    if (isSafeNextPath(next)) return next;
    const redirect = params.get('redirect');
    if (isSafeNextPath(redirect)) return redirect;
  } catch {
    // Query tidak dapat diparse: abaikan, callback memakai tujuan berbasis role.
  }
  return null;
}

/**
 * Bangun URL callback untuk OAuth:
 * `/auth/callback?oauth=google` (+ `next` bila aman).
 * `nextPath` yang tidak aman diabaikan, bukan diteruskan.
 */
export function getOAuthCallbackUrl(nextPath?: string | null): string {
  const params = new URLSearchParams({
    [OAUTH_CALLBACK_PARAM]: OAUTH_CALLBACK_VALUE,
  });
  if (isSafeInternalPath(nextPath)) {
    params.set('next', nextPath);
  }
  return `${getSiteOrigin()}/auth/callback?${params.toString()}`;
}

/** true bila callback dibuka oleh alur OAuth (bukan verifikasi email/OTP). */
export function isOAuthCallback(search: string): boolean {
  try {
    const params = new URLSearchParams(search);
    return params.get(OAUTH_CALLBACK_PARAM) === OAUTH_CALLBACK_VALUE;
  } catch {
    return false;
  }
}

/**
 * Petakan error OAuth (pembatalan, konflik email, konfigurasi provider) menjadi
 * pesan Indonesia. Tidak pernah menampilkan detail konfigurasi, host, atau
 * pesan mentah penyedia ke pengguna.
 */
export function mapOAuthError(rawMessage: string): string {
  const msg = (rawMessage || '').toLowerCase();

  if (!msg) {
    return 'Masuk dengan Google gagal. Silakan coba lagi, atau masuk dengan email dan kata sandi.';
  }

  // Pengguna menekan "Batal" / menolak izin di layar Google.
  if (
    msg.includes('access_denied') ||
    msg.includes('access denied') ||
    msg.includes('cancel') ||
    msg.includes('denied')
  ) {
    return 'Masuk dengan Google dibatalkan. Kamu bisa mencoba lagi atau masuk dengan email dan kata sandi.';
  }

  // Email Google sudah terdaftar lewat jalur lain dan identity tidak dapat
  // ditautkan otomatis. Jangan pernah menyarankan merge manual.
  if (
    msg.includes('email_exists') ||
    msg.includes('already registered') ||
    msg.includes('already linked') ||
    msg.includes('identity is already') ||
    msg.includes('linked to another user')
  ) {
    return 'Email Google ini sudah terdaftar di ReBites dengan kata sandi. Masuk menggunakan email dan kata sandi tersebut, atau gunakan akun Google dengan email lain.';
  }

  // Provider belum aktif / konfigurasi dashboard belum lengkap.
  if (
    msg.includes('provider is not enabled') ||
    msg.includes('unsupported provider') ||
    msg.includes('validation_failed')
  ) {
    return 'Masuk dengan Google belum tersedia saat ini. Silakan masuk dengan email dan kata sandi.';
  }

  if (
    msg.includes('redirect') ||
    msg.includes('redirect_uri_mismatch') ||
    msg.includes('invalid request')
  ) {
    return 'Masuk dengan Google belum bisa diselesaikan karena pengalihan tidak dikenali. Coba lagi, atau masuk dengan email dan kata sandi. Bila berulang, hubungi halo@rebites.id.';
  }

  // Code verifier hilang (browser/perangkat berbeda) — sama seperti alur PKCE email.
  if (msg.includes('code verifier') || msg.includes('pkce') || msg.includes('flow_state')) {
    return 'Proses Google tidak bisa dilanjutkan di browser ini. Ulangi masuk dengan Google dari awal di browser yang sama.';
  }

  if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('429')) {
    return 'Terlalu banyak percobaan masuk. Tunggu sekitar 1 menit, lalu coba lagi.';
  }

  return 'Masuk dengan Google gagal. Silakan coba lagi, atau masuk dengan email dan kata sandi.';
}
