"use client";
import { useEffect } from "react";
import Image from "next/image";
import { Plus_Jakarta_Sans, Be_Vietnam_Pro } from "next/font/google";
import { Home, RotateCcw } from "lucide-react";
import "./globals.css";
import { ErrorBackgroundMarquee } from "@/app/components/shared/error-background-marquee";
const plusJakartaSans = Plus_Jakarta_Sans({
    subsets: ["latin"],
    variable: "--font-sans",
    display: "swap",
    weight: ["200", "300", "400", "500", "600", "700", "800"],
    style: ["normal", "italic"],
    preload: false,
});
const beVietnamPro = Be_Vietnam_Pro({
    subsets: ["latin"],
    variable: "--font-secondary",
    display: "swap",
    weight: ["400", "500", "600", "700"],
    style: ["normal"],
    preload: false,
});
export default function GlobalError({ error, reset, }: {
    error: Error & {
        digest?: string;
    };
    reset: () => void;
}) {
    useEffect(() => {
// eslint-disable-next-line no-console
        console.error("[ReBites] global error:", error);
    }, [error]);
    return (<html lang="id" className={`${plusJakartaSans.variable} ${beVietnamPro.variable}`}>
      <body className="font-sans antialiased">
        <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-forest-900 px-6 pb-24 pt-20 text-center">
          <ErrorBackgroundMarquee code="ERROR 500" label="SERVER ERROR"/>

          
          <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/25 blur-[120px]"/>

          <div className="relative z-10 flex w-full max-w-xl flex-col items-center">
            <Image src="/logo.avif" alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/20"/>

            
            <p aria-hidden="true" className="mt-8 font-display text-[clamp(5rem,16vw,9.5rem)] font-extrabold leading-none tracking-[-0.04em] text-white tabular-nums">
              500
            </p>

            <h1 className="mt-4 font-display text-xl font-semibold tracking-tight text-white sm:text-2xl">
              <span className="sr-only">Error 500: </span>
              Ada gangguan di dapur kami
            </h1>

            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/70 sm:text-[15px]">
              Saat menyajikan halaman ini terjadi masalah tak terduga. Pesanan
              dan akunmu tetap aman — coba muat ulang, atau kembali lagi
              beberapa saat.
            </p>

            <div className="mt-7 flex w-full flex-col items-center gap-1 sm:mt-9 sm:w-auto sm:flex-row sm:gap-3">
              <button type="button" onClick={() => reset()} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white px-7 font-sans text-sm font-semibold text-forest-900 shadow-lg shadow-black/25 transition duration-200 hover:bg-cream-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98] sm:w-auto">
                <RotateCcw className="h-4 w-4" aria-hidden/>
                Coba Lagi
              </button>
              
              <a href="/home" className="inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-3 font-sans text-sm font-semibold text-white/75 underline underline-offset-4 transition duration-200 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:scale-[0.98] sm:h-12 sm:w-auto sm:border sm:border-white/35 sm:px-7 sm:py-0 sm:text-white sm:no-underline sm:hover:bg-white/10">
                <Home className="h-4 w-4" aria-hidden/>
                Kembali ke Beranda
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>);
}
