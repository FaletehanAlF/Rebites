'use client';

import { refreshAdminSessionSafe } from '@/lib/admin-auth';

/**
 * Tangani kegagalan sesi pada satu request admin.
 *
 * KONTRAK (dipakai sembilan view admin):
 * - `503` → Supabase tidak terjangkau. Panggil `onOffline()` (view menampilkan
 *   pesan + tombol coba lagi) dan kembalikan `true`; JANGAN redirect ke login,
 *   karena sesinya masih ada dan pengguna hanya akan mengira dirinya keluar.
 * - `401` → `fetchAdminWithAuth` sudah melakukan satu refresh + satu retry.
 *   Bila 401 masih tersisa, coba satu refresh terakhir:
 *   - refresh GAGAL → sesi tidak dapat dipulihkan → ke `/auth/login`, `true`;
 *   - refresh BERHASIL → `false`, sehingga caller WAJIB mengisi state error
 *     (bukan `return` diam-diam). Versi lama selalu mengembalikan `true`,
 *     sehingga status yang sudah di-set `'loading'` tidak pernah ditimpa dan
 *     halaman berputar selamanya tanpa pesan maupun tombol retry.
 * - Status lain → `false` (bukan urusan sesi; caller menangani 403/500).
 *
 * Hanya satu percobaan refresh per request: tidak ada loop, dan redirect hanya
 * terjadi bila sesi benar-benar tidak dapat dipulihkan.
 */
export async function redirectIfSessionExpired(
  status: number,
  router: { replace: (href: string) => void },
  onOffline: () => void
): Promise<boolean> {
  if (status === 503) {
    onOffline();
    return true;
  }
  if (status !== 401) return false;
  const refreshed = await refreshAdminSessionSafe();
  if (!refreshed) {
    router.replace('/auth/login');
    return true;
  }
  return false;
}
