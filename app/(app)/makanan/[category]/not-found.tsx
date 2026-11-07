import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";
import { BuyerShell } from "@/app/components/shared/buyer-shell";
import { AppFooter } from "@/app/components/shared/app-footer";
export default function CategoryNotFound() {
    return (<BuyerShell>
      <main className="flex min-h-[65vh] items-center justify-center px-4 pb-24 pt-10 lg:pb-16">
        <div className="w-full max-w-md rounded-2xl border border-border bg-white px-6 py-14 text-center shadow-md shadow-primary/5">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Compass className="h-7 w-7 text-muted-foreground" aria-hidden/>
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground">
            Kategori tidak ditemukan
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Kategori makanan yang kamu cari tidak tersedia.
          </p>
          <Link href="/home" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-all duration-200 hover:bg-primary-dark active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white">
            <ArrowLeft className="h-4 w-4" aria-hidden/>
            Kembali ke Beranda
          </Link>
        </div>
      </main>
      <AppFooter hasMobileBottomNav/>
    </BuyerShell>);
}
