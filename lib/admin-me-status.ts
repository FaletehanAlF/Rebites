/**
 * Klasifikasi kegagalan pemeriksaan status admin — modul MURNI (tanpa impor
 * runtime) sehingga dapat diuji langsung dengan `node --test`.
 *
 * MASALAH YANG DIPERBAIKI: `useAdminMe()` menyimpan `me = null` untuk SEMUA
 * kegagalan. Akibatnya gangguan jaringan/server tampil identik dengan "bukan
 * admin": halaman Pengaturan menulis "Tidak terverifikasi", editor peran
 * menyembunyikan form permintaan, dan dialog sanksi menyembunyikan tombolnya —
 * padahal pengguna mungkin Super Admin yang sah.
 *
 * Hanya penolakan yang PASTI yang boleh menjadi `unverified`:
 * - 401: tidak ada sesi valid (refresh sudah dicoba `fetchAdminWithAuth`).
 * - 403: sesi sah, tetapi bukan admin.
 *
 * Selain itu — 500, 503, timeout, atau `fetch` gagal (status tidak ada / 0) —
 * adalah `error`: sesi belum tentu hilang, dan hak akses tidak boleh
 * disimpulkan dari kegagalan sistem.
 */

export type AdminMeStatus = 'loading' | 'verified' | 'unverified' | 'error';

/** Status yang berarti pemeriksaan TIDAK menghasilkan keputusan admin. */
export type AdminMeFailureStatus = Exclude<AdminMeStatus, 'loading' | 'verified'>;

export interface AdminMeFailure {
  status: AdminMeFailureStatus;
  /** Pesan aman untuk ditampilkan; hanya terisi saat `error`. */
  message: string | null;
}

export const ADMIN_ME_ERROR_MESSAGE =
  'Tidak dapat memeriksa status admin. Periksa koneksi internet lalu coba lagi.';

/**
 * `error` dibaca secara struktural (bukan `instanceof AdminMeApiError`) supaya
 * modul ini tetap murni dan dapat dimuat runner tes offline.
 */
export function classifyAdminMeFailure(error: unknown): AdminMeFailure {
  const raw = (error as { status?: unknown } | null)?.status;
  const status = typeof raw === 'number' ? raw : 0;

  if (status === 401 || status === 403) {
    return { status: 'unverified', message: null };
  }

  return { status: 'error', message: ADMIN_ME_ERROR_MESSAGE };
}
