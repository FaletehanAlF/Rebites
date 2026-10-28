"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchAdminMe } from "@/lib/admin-me";
import { withTimeout } from "@/lib/async-timeout";
import { fetchCurrentUserRole, getHomePathForRole } from "@/lib/current-user";

/**
 * Guard client-side untuk halaman admin. Memastikan ada sesi dan
 * profiles.role === 'admin', selain itu redirect.
 *
 * Catatan: ini hanya UX gate. Otorisasi sebenarnya tetap di server
 * (API /api/admin/* memakai getAdminUser()).
 *
 * EMPAT STATUS YANG BERBEDA — dan kenapa penting:
 * - `loading`         : pemeriksaan belum selesai.
 * - `unauthenticated` : tidak ada sesi / token ditolak → ke /auth/login.
 * - `forbidden`       : sesi sah tetapi bukan admin → ke beranda.
 * - `error`           : pemeriksaan GAGAL karena jaringan/server (5xx,
 *                       timeout, fetch gagal). BUKAN "bukan admin": sesinya
 *                       mungkin masih sah, jadi pengguna TIDAK dialihkan.
 *                       Halaman menampilkan pesan + tombol coba lagi.
 *
 * Versi sebelumnya melebur `error` menjadi `unauthenticated` (catch →
 * /auth/login) dan kegagalan query profil menjadi "bukan admin" (→ "/"),
 * sehingga gangguan sesaat melempar admin ke login/beranda padahal sesinya
 * masih berlaku. `isAdmin` sengaja TIDAK pernah true kecuali verdict admin
 * benar-benar diterima server (fail-closed).
 */
export type AdminGuardStatus =
  | "loading"
  | "admin"
  | "forbidden"
  | "unauthenticated"
  | "error";

export interface AdminGuardResult {
  status: AdminGuardStatus;
  loading: boolean;
  isAdmin: boolean;
  /** Pesan yang aman untuk ditampilkan; hanya terisi saat `error`. */
  errorMessage: string | null;
  /** Ulangi pemeriksaan tanpa memuat ulang halaman. */
  retry: () => void;
}

const ERROR_MESSAGE =
  "Tidak dapat memeriksa status admin. Periksa koneksi internet lalu coba lagi.";

/**
 * Pemeriksaan yang menggantung tidak boleh mengunci halaman selamanya:
 * `fetchAdminMe` dapat menunggu tanpa batas bila server tidak menjawab.
 * Pembungkusnya dipakai bersama `useAdminMe` (lib/async-timeout.ts).
 */
const ADMIN_CHECK_TIMEOUT_MS = 15_000;

function statusOf(error: unknown): number {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : 0;
}

export function useRequireAdmin(): AdminGuardResult {
  const router = useRouter();
  const [status, setStatus] = useState<AdminGuardStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Setiap percobaan (termasuk retry) menaikkan id; hasil yang datang
  // terlambat dari percobaan lama diabaikan agar tidak menimpa status terbaru.
  const requestIdRef = useRef(0);

  const retry = useCallback(() => {
    setStatus("loading");
    setErrorMessage(null);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const isCurrent = () => active && requestId === requestIdRef.current;

    (async () => {
      try {
        const {
          data: { session },
        } = await withTimeout(supabase.auth.getSession(), ADMIN_CHECK_TIMEOUT_MS);
        if (!isCurrent()) return;
        if (!session) {
          // Tidak ada sesi sama sekali: keputusan pasti, bukan gangguan.
          setStatus("unauthenticated");
          router.replace("/auth/login");
          return;
        }

        const me = await withTimeout(fetchAdminMe(), ADMIN_CHECK_TIMEOUT_MS);
        if (!isCurrent()) return;
        // `/api/admin/me` hanya menjawab 200 untuk admin, dan fetchAdminMe()
        // sudah memvalidasi bentuk respons (dua boolean). Non-admin dijawab
        // 403 dan ditangani di catch — jangan longgarkan pemeriksaan ini.
        if (!me) {
          setErrorMessage(ERROR_MESSAGE);
          setStatus("error");
          return;
        }
        setStatus("admin");
      } catch (err) {
        if (!isCurrent()) return;
        const httpStatus = statusOf(err);
        if (httpStatus === 401) {
          setStatus("unauthenticated");
          router.replace("/auth/login");
          return;
        }
        if (httpStatus === 403) {
          setStatus("forbidden");
          // Sesi sah tetapi bukan admin. Antar ke beranda SESUAI ROLE-nya,
          // bukan ke halaman pemasaran "/". Tanpa ini, pengguna yang perannya
          // baru diubah (mis. UMKM) terlempar ke landing page dan harus
          // mencari sendiri dashboard-nya.
          // Tetap fail-closed: pengguna tidak pernah dirender isi admin.
          let destination = "/home";
          try {
            const role = await withTimeout(
              fetchCurrentUserRole(),
              ADMIN_CHECK_TIMEOUT_MS
            );
            if (role) destination = getHomePathForRole(role);
          } catch {
            // Gagal membaca role: jangan menebak, pakai beranda umum.
          }
          if (!isCurrent()) return;
          router.replace(destination);
          return;
        }
        // 5xx, timeout, atau kegagalan jaringan: JANGAN redirect. Sesi belum
        // tentu habis, dan memindahkan admin ke login/beranda menyembunyikan
        // gangguan sebagai "Anda bukan admin".
        setErrorMessage(ERROR_MESSAGE);
        setStatus("error");
      }
    })();

    return () => {
      active = false;
    };
  }, [router, attempt]);

  return {
    status,
    loading: status === "loading",
    isAdmin: status === "admin",
    errorMessage,
    retry,
  };
}
