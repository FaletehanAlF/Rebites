"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { isSafeRedirectPath, useCurrentUser } from "@/lib/current-user";

/**
 * Gate client-side untuk halaman yang mewajibkan login (/home, profil,
 * riwayat pesanan, notifikasi pembeli).
 *
 * - Memakai pola autentikasi yang sudah ada (`useCurrentUser`:
 *   `getSession()` + listener `onAuthStateChange`), tanpa mekanisme baru.
 * - Menahan render anak sampai status auth pasti: selama `loading` maupun
 *   setelah redirect dipicu, tampil spinner yang konsisten dengan desain
 *   (tidak ada flash konten pribadi).
 * - Tanpa sesi valid -> `router.replace()` ke `/auth/login`, dengan
 *   `?redirect=` bila path saat ini aman. `AuthForm` sudah mendukung
 *   `?redirect=` dan memvalidasinya via `isSafeRedirectPath`, sehingga
 *   tidak ada open-redirect ke URL eksternal.
 * - Anak (termasuk efek fetch-nya) TIDAK di-mount sebelum ada user,
 *   sehingga tidak ada permintaan API data pribadi saat logged-out dan
 *   tidak ada fetch berulang akibat sesi berubah.
 * - Ini BUKAN satu-satunya lapisan: API tetap memvalidasi Bearer via
 *   `getUserFromBearer()` dan RLS tetap berlaku di server.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  useEffect(() => {
    if (loading || user) return;
    const current =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "";
    const loginTarget =
      current && isSafeRedirectPath(current)
        ? `/auth/login?redirect=${encodeURIComponent(current)}`
        : "/auth/login";
    router.replace(loginTarget);
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div
        className="flex min-h-[40vh] items-center justify-center"
        aria-busy="true"
        aria-label="Memeriksa sesi login"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
