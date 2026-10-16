import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { ProfileNavbar } from "@/app/components/shared/navbar";
import { SiteFooter } from "@/app/components/shared/site-footer";

export default function CategoryNotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-secondary">
      <ProfileNavbar />
      <main className="flex flex-1 items-center justify-center px-4 pb-16 pt-28">
        <div className="w-full max-w-md rounded-2xl border border-border bg-white px-6 py-14 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Compass className="h-7 w-7 text-muted-foreground" aria-hidden />
          </span>
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-foreground">
            Kategori tidak ditemukan
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Kategori makanan yang kamu cari tidak tersedia.
          </p>
          <Link
            href="/homePage"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-primary-dark active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Kembali ke Beranda
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
