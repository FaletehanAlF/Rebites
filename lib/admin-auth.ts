'use client';

/**
 * Kompatibilitas admin: delegasi ke helper tunggal @/lib/auth-token.
 *
 * Seluruh logika refresh serial / margin expired / tanpa-fallback-token-basi
 * tinggal di `lib/auth-token.ts` agar buyer, checkout, dan admin memakai
 * SATU mekanisme yang konsisten. File ini dipertahankan agar import lama
 * (`getAdminAuthHeader`, `refreshAdminSessionSafe`, `AdminAuthError`)
 * tidak pecah.
 */

import {
  AuthError,
  fetchWithAuth as baseFetchWithAuth,
  getValidAuthHeader,
  refreshSessionSafe,
} from './auth-token';

export class AdminAuthError extends AuthError {
  constructor(message = 'Sesi habis, silakan login ulang.', status = 401) {
    super(message, status);
    this.name = 'AdminAuthError';
  }
}

export interface AdminAuthHeaderOptions {
  /** Bila true, lewati token cached dan paksa refresh serial satu kali. */
  forceRefresh?: boolean;
}

/**
 * Kembalikan `Bearer <access_token>` yang valid untuk API admin.
 * Throw AdminAuthError(401) bila tidak ada session valid dan refresh gagal.
 */
export async function getAdminAuthHeader(
  opts?: AdminAuthHeaderOptions
): Promise<string> {
  try {
    return await getValidAuthHeader(opts);
  } catch (err) {
    if (err instanceof AuthError) {
      throw new AdminAuthError(err.message, err.status);
    }
    throw err;
  }
}

/**
 * Paksa refresh session secara aman (serial, shared promise).
 * Return true bila ada session valid setelah refresh, false bila gagal.
 * Tidak pernah throw; tidak pernah signOut otomatis.
 */
export async function refreshAdminSessionSafe(): Promise<boolean> {
  return refreshSessionSafe();
}

export { baseFetchWithAuth as fetchAdminWithAuth };
