'use client';

import { useEffect } from 'react';
import { RotateCcw, ShieldAlert } from 'lucide-react';

/**
 * Error boundary segmen panel admin.
 *
 * Dirender di dalam layout yang ada (tidak menyentuh `<html>`/`<body>`),
 * sehingga sidebar dan topbar tetap terlihat saat satu halaman gagal.
 * `global-error.tsx` tidak berlaku di sini — file itu hanya aktif bila root
 * layout sendiri gagal.
 *
 * Detail teknis hanya ke console; UI menampilkan pesan umum.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[ReBites] error di panel admin:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-[var(--radius)] border border-border bg-admin-panel p-6 text-center shadow-admin-card">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert aria-hidden className="h-7 w-7 text-destructive" />
        </div>

        <h1 className="mt-4 font-display text-lg font-semibold text-charcoal-900">
          Halaman ini gagal dimuat
        </h1>
        <p className="mt-1.5 text-sm text-sage-500">
          Terjadi gangguan saat menampilkan halaman admin. Data Anda tidak
          terpengaruh — silakan coba lagi.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <RotateCcw aria-hidden className="h-4 w-4" />
            Coba lagi
          </button>
          {/* Anchor biasa agar tetap berfungsi walau router bermasalah. */}
          <a
            href="/dashboard/admin"
            className="inline-flex items-center justify-center rounded-[var(--radius)] border border-border bg-white px-4 py-2 text-sm font-semibold text-charcoal-700 transition-colors hover:bg-admin-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Kembali ke Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
