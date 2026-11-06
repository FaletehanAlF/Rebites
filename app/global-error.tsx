"use client";

import { useEffect } from "react";
import { CloudOff, Home, RotateCcw } from "lucide-react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Hanya untuk diagnostik developer (console); tidak tampil di UI.
    // eslint-disable-next-line no-console
    console.error("[ReBites] global error:", error);
  }, [error]);

  return (
    <html lang="id">
      <body className="antialiased">
        <main className="flex min-h-screen items-center justify-center bg-cream-50 px-6 py-16">
          <div className="w-full max-w-md rounded-3xl border border-hairline/70 bg-white p-8 text-center shadow-[0_24px_48px_-32px_rgba(42,55,49,0.35)] sm:p-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-cream-100 ring-1 ring-hairline">
              <CloudOff className="h-9 w-9 text-caramel" aria-hidden />
            </div>

            <h1 className="mt-6 font-sans text-xl font-semibold tracking-tight text-charcoal-900">
              Dapur sedang bermasalah
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-stone">
              Terjadi gangguan tak terduga saat menyajikan halaman ini.
              Tenang, pesanan dan akunmu aman — silakan coba lagi.
            </p>

            <div className="mt-7 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-5 text-sm font-semibold text-primary-foreground-strong transition-colors hover:bg-primary/90"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Coba Lagi
              </button>
              {/* Anchor biasa (bukan router) agar tetap berfungsi walau
                  router ikut rusak saat error global. */}
              <a
                href="/home"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-primary/30 bg-white px-5 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground-strong"
              >
                <Home className="h-4 w-4" aria-hidden />
                Kembali ke Beranda
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
