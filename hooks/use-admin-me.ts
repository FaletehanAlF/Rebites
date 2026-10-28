'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAdminMe, type AdminMe } from '@/lib/admin-me';
import {
  classifyAdminMeFailure,
  type AdminMeStatus,
} from '@/lib/admin-me-status';
import { withTimeout } from '@/lib/async-timeout';

/**
 * Batas waktu pemeriksaan status admin. Tanpa ini, request yang menggantung
 * membuat spinner "Memeriksa izin…" menyala tanpa batas.
 */
const ADMIN_ME_TIMEOUT_MS = 15_000;

export interface UseAdminMeResult {
  /** Pemeriksaan sedang berjalan. */
  loading: boolean;
  /**
   * Hasil pemeriksaan. `null` BUKAN bukti "bukan Super Admin": `null` juga
   * berarti pemeriksaan belum selesai atau gagal. Pakai `status` untuk itu.
   */
  me: AdminMe | null;
  /**
   * - `loading`    : belum selesai.
   * - `verified`   : server memverifikasi admin; `me` berisi dua boolean.
   * - `unverified` : sesi tidak valid (401) atau bukan admin (403).
   * - `error`      : pemeriksaan GAGAL (5xx, 503, timeout, jaringan). Hak
   *                  akses TIDAK disimpulkan dari kegagalan sistem.
   */
  status: AdminMeStatus;
  /** Pesan aman untuk ditampilkan; hanya terisi saat `status === 'error'`. */
  errorMessage: string | null;
  /** Ulangi pemeriksaan tanpa memuat ulang halaman. */
  retry: () => void;
}

/**
 * Ambil status akses admin (is_super_admin / super_admin_configured) sekali
 * saat mount, plus `retry()` bila pemeriksaan gagal.
 *
 * Catatan: ini HANYA untuk UX. Penegakan otorisasi selalu di server.
 *
 * Fail-closed tetap berlaku: `me` hanya terisi setelah server menjawab 200,
 * sehingga `me?.isSuperAdmin === true` tidak pernah true selama status belum
 * `verified` — termasuk saat `error`.
 */
export function useAdminMe(): UseAdminMeResult {
  const [state, setState] = useState<{
    me: AdminMe | null;
    status: AdminMeStatus;
    errorMessage: string | null;
  }>({ me: null, status: 'loading', errorMessage: null });
  const [attempt, setAttempt] = useState(0);
  // Retry dapat berjalan sebelum percobaan sebelumnya selesai; hanya hasil
  // percobaan terbaru yang boleh menulis state.
  const requestIdRef = useRef(0);

  const retry = useCallback(() => {
    setState((prev) => ({ ...prev, me: null, status: 'loading', errorMessage: null }));
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const isCurrent = () => active && requestId === requestIdRef.current;

    (async () => {
      try {
        const me = await withTimeout(fetchAdminMe(), ADMIN_ME_TIMEOUT_MS);
        if (!isCurrent()) return;
        setState({ me, status: 'verified', errorMessage: null });
      } catch (err) {
        if (!isCurrent()) return;
        const failure = classifyAdminMeFailure(err);
        // `unverified` (401/403): keputusan pasti, `me` tetap null.
        // `error` (5xx/timeout/jaringan): JANGAN menampilkan ini sebagai
        // penolakan hak akses — sesi mungkin masih sah.
        setState({
          me: null,
          status: failure.status,
          errorMessage: failure.message,
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [attempt]);

  return {
    loading: state.status === 'loading',
    me: state.me,
    status: state.status,
    errorMessage: state.errorMessage,
    retry,
  };
}
