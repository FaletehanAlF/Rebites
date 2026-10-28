'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAdminRoleRequests } from '@/lib/role-requests';
import {
  ADMIN_ROLE_DECISIONS_EVENT,
  readSeenRoleDecisionIds,
} from '@/lib/admin-preferences';

/**
 * Angka badge pada menu "Permintaan Role" di sidebar admin.
 *
 * Badge ini punya DUA arti berbeda, dan sebelumnya hanya satu yang dihitung:
 *
 * - `pending`  (Super Admin): berapa permintaan yang MENUNGGU keputusan.
 * - `decision` (admin pengaju): berapa permintaannya sendiri yang SUDAH
 *   DIPUTUSKAN (disetujui/ditolak) tetapi belum dilihatnya.
 *
 * BUG yang diperbaiki: dulu hook ini hanya mengambil `status: 'pending'` dan
 * hanya diaktifkan untuk Super Admin. Akibatnya, ketika Super Admin menolak
 * permintaan seorang admin tim, admin itu TIDAK mendapat tanda apa pun saat
 * kembali ke panel — ia harus membuka halaman dan membaca sendiri. Keputusan
 * atas permintaannya adalah peristiwa yang harus terlihat.
 *
 * Untuk menghitung keputusan yang belum dilihat, daftar milik sendiri
 * (`mine=1`) diambil satu halaman lalu disaring dengan ID yang sudah dilihat
 * (localStorage, lihat `markRoleDecisionsSeen`). `total` dari server tidak
 * bisa dipakai langsung karena server tidak tahu apa yang sudah dilihat.
 *
 * Realtime sengaja TIDAK dipakai: `role_change_requests` belum terdaftar di
 * publication `supabase_realtime`, sehingga subscription akan diam tanpa
 * error — polling yang jujur lebih baik.
 */
const POLL_INTERVAL_MS = 20_000;
/** Cukup untuk menangkap keputusan terbaru tanpa mengambil seluruh riwayat. */
const DECISION_SCAN_LIMIT = 20;

export type RoleBadgeKind = 'pending' | 'decision';

export interface RoleRequestBadge {
  /** Jumlah yang perlu ditandai; null = belum diketahui / tidak berlaku. */
  count: number | null;
  /** Arti angka di atas, dipakai untuk label aksesibel. */
  kind: RoleBadgeKind | null;
  /** Segarkan manual (mis. setelah memutuskan atau setelah melihat halaman). */
  refresh: () => void;
}

export function useRoleRequestBadge(
  enabled: boolean,
  isSuperAdmin: boolean
): RoleRequestBadge {
  const [state, setState] = useState<{
    count: number | null;
    kind: RoleBadgeKind | null;
  }>({ count: null, kind: null });
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      if (isSuperAdmin) {
        const result = await fetchAdminRoleRequests({
          status: 'pending',
          limit: 1,
          offset: 0,
        });
        // Respons lama tidak boleh menimpa hasil yang lebih baru.
        if (requestId !== requestIdRef.current) return;
        if (result.notProvisioned) {
          setState({ count: null, kind: null });
          return;
        }
        setState({ count: result.total, kind: 'pending' });
        return;
      }

      // Admin pengaju: hitung permintaan sendiri yang sudah diputuskan dan
      // belum dilihat.
      const result = await fetchAdminRoleRequests({
        mine: true,
        limit: DECISION_SCAN_LIMIT,
        offset: 0,
      });
      if (requestId !== requestIdRef.current) return;
      if (result.notProvisioned) {
        setState({ count: null, kind: null });
        return;
      }
      const seen = readSeenRoleDecisionIds();
      const unseen = result.requests.filter(
        (item) =>
          item.requested_by_me === true &&
          typeof item.id === 'string' &&
          (item.status === 'approved' || item.status === 'rejected') &&
          !seen.has(item.id)
      ).length;
      setState({ count: unseen, kind: 'decision' });
    } catch {
      // 401/403 berarti bukan admin lagi; kegagalan lain bersifat sementara.
      // Badge adalah aksesori: sembunyikan, jangan tampilkan error merah.
      if (requestId !== requestIdRef.current) return;
      setState({ count: null, kind: null });
    }
  }, [enabled, isSuperAdmin]);

  useEffect(() => {
    if (!enabled) {
      setState({ count: null, kind: null });
      return;
    }
    void load();

    const intervalId = window.setInterval(() => {
      // Hanya saat tab terlihat: menghemat kuota saat admin meninggalkan tab.
      if (document.visibilityState === 'visible') void load();
    }, POLL_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    // Halaman Permintaan Role menandai keputusan sebagai sudah dilihat;
    // badge harus langsung hilang tanpa menunggu polling berikutnya.
    const onSeen = () => void load();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(ADMIN_ROLE_DECISIONS_EVENT, onSeen);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(ADMIN_ROLE_DECISIONS_EVENT, onSeen);
    };
  }, [enabled, load]);

  return { ...state, refresh: () => void load() };
}
