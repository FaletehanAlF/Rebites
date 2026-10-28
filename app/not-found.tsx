import Link from "next/link";
import Image from "next/image";
import { Home, UtensilsCrossed } from "lucide-react";
import { Button } from "@/app/components/ui/button";

/**
 * Halaman 404 ReBites.
 *
 * Dipakai untuk dua kondisi:
 * 1. URL yang memang tidak dikenal (fallback root `not-found.tsx`).
 * 2. `notFound()` dari segmen bersarang, mis. `app/makanan/[category]`.
 *
 * Sisi server (tanpa `"use client"`) supaya HTML 404 benar-benar ter-render
 * di respons pertama, tidak bergantung pada hidrasi React. Karena itu tombol
 * navigasi memakai `Link`/`a` biasa, bukan `useRouter()`.
 *
 * Catatan rute: CTA "Kembali ke Beranda" mengarah ke `/home` (route yang
 * benar, dilindungi `RequireAuth`) — bukan `/homePage`, yang tidak pernah
 * ada sebagai route sehingga hanya menghasilkan 404 lagi.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col bg-cream-50">
      <div className="flex flex-1 items-center justify-center px-4 py-16 sm:py-24">
        <div className="w-full max-w-lg rounded-[var(--radius)] border border-hairline bg-white px-6 py-12 text-center shadow-[0_24px_48px_-32px_rgba(42,55,49,0.35)] sm:px-10 sm:py-14">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-cream-100 ring-1 ring-hairline">
            <UtensilsCrossed className="h-7 w-7 text-caramel" aria-hidden />
          </span>

          <p className="mt-6 font-display text-5xl font-bold tracking-tight text-primary">
            404
          </p>

          <div className="mt-3 flex items-center justify-center gap-2">
            <Image
              src="/logo.png"
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 rounded-full object-cover"
            />
            <h1 className="font-display text-xl font-semibold tracking-tight text-charcoal-900">
              Hidangan tidak ditemukan
            </h1>
          </div>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-stone">
            Halaman yang kamu cari sudah habis seperti makanan surplus
            favorit — atau mungkin salah alamat. Yuk kembali berburu kuliner
            enak.
          </p>

          <div className="mt-8 flex flex-col items-center gap-2.5 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/home">
                <Home className="h-4 w-4" aria-hidden />
                Kembali ke Beranda
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="/">Landing Page ReBites</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}