"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Coins, MapPin, PanelLeftClose, PanelLeftOpen, Store, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { RequireAuth } from "@/app/components/auth/require-auth";
import {
  BuyerShell,
  getSidebarCollapsedPreference,
  setSidebarCollapsedPreference,
  SIDEBAR_COLLAPSED_CHANGED_EVENT,
} from "@/app/components/shared/buyer-shell";

/**
 * Halaman Pengaturan pembeli.
 *
 * Isi hanya kontrol yang benar-benar disimpan dan diterapkan aplikasi:
 * - Tautan pengelolaan akun (profil, alamat, coin) — route existing.
 * - Preferensi "sidebar ringkas" — tersimpan di localStorage dan benar-benar
 *   dibaca BuyerShell (tersinkron instan via SIDEBAR_COLLAPSED_CHANGED_EVENT).
 *
 * Pengaturan notifikasi/keamanan belum ditambahkan karena aplikasi belum
 * punya mekanisme penyimpanan/penerapan yang nyata untuk itu.
 */

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white";

const ACCOUNT_LINKS = [
  {
    href: "/profile",
    icon: User,
    title: "Kelola Profil",
    description: "Ubah nama, foto profil, dan informasi akun.",
  },
  {
    href: "/profile#alamat",
    icon: MapPin,
    title: "Alamat Pengiriman",
    description: "Perbarui alamat utama untuk pengiriman pesanan.",
  },
  {
    href: "/pengaturan/coin",
    icon: Coins,
    title: "ReBites Coin",
    description: "Lihat saldo dan riwayat koin, termasuk yang diberikan tim ReBites.",
  },
  {
    href: "/toko-diikuti",
    icon: Store,
    title: "Toko Diikuti",
    description: "Kelola daftar toko yang kamu ikuti.",
  },
] as const;

function PengaturanView() {
  const [compactSidebar, setCompactSidebar] = useState(false);

  useEffect(() => {
    setCompactSidebar(getSidebarCollapsedPreference());

    // Sinkron bila preferensi diubah dari lokasi lain (tombol sidebar atau
    // tab lain) supaya toggle tidak menampilkan status yang basi.
    const sync = () => setCompactSidebar(getSidebarCollapsedPreference());
    window.addEventListener(SIDEBAR_COLLAPSED_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SIDEBAR_COLLAPSED_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const handleToggleCompact = () => {
    const next = !compactSidebar;
    setCompactSidebar(next);
    setSidebarCollapsedPreference(next);
  };

  return (
    <BuyerShell>
      <main className="pb-28 pt-4 sm:pt-6 lg:pb-12 lg:pt-8">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
            Pengaturan
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola preferensi dan pintasan akun penggunamu.
          </p>          <section className="mt-6" aria-labelledby="pengaturan-akun">
            <h2
              id="pengaturan-akun"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              Akun
            </h2>
            <div className="mt-3 divide-y divide-border/70 overflow-hidden rounded-2xl border border-border bg-white">
              {ACCOUNT_LINKS.map(({ href, icon: Icon, title, description }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "group flex items-center gap-3.5 px-4 py-4 transition-colors hover:bg-muted/50",
                    FOCUS_RING,
                  )}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-foreground">
                      {title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {description}
                    </span>
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden
                  />
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-8" aria-labelledby="pengaturan-preferensi">
            <h2
              id="pengaturan-preferensi"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
            >
              Preferensi
            </h2>
            <div className="mt-3 rounded-2xl border border-border bg-white px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    Mode navigasi ringkas
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Tangkai sidebar menampilkan ikon saja supaya konten lebih
                    lebar (berlaku di desktop).
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={compactSidebar}
                  aria-label="Aktifkan mode navigasi ringkas"
                  onClick={handleToggleCompact}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                    compactSidebar ? "bg-primary" : "bg-muted",
                    FOCUS_RING,
                  )}
                >
                  <span
                    className={cn(
                      "absolute h-5 w-5 rounded-full bg-white shadow-sm transition-all",
                      compactSidebar ? "left-[1.5rem]" : "left-0.5",
                    )}
                  />
                  <span className="sr-only">
                    {compactSidebar ? "Aktif" : "Nonaktif"}
                  </span>
                </button>
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {compactSidebar ? (
                  <>
                    <PanelLeftClose className="h-3.5 w-3.5" aria-hidden />
                    Sidebar ringkas aktif
                  </>
                ) : (
                  <>
                    <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden />
                    Sidebar penuh aktif
                  </>
                )}
              </p>
            </div>
          </section>

          <p className="mt-8 rounded-2xl border border-dashed border-border bg-secondary px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            Pengaturan notifikasi dan keamanan akun (ubah kata sandi, verifikasi
            dua langkah) belum tersedia di ReBites sehingga tidak ditampilkan
            di sini.
          </p>
        </div>
      </main>
    </BuyerShell>
  );
}

export default function PengaturanPage() {
  return (
    <RequireAuth>
      <PengaturanView />
    </RequireAuth>
  );
}
