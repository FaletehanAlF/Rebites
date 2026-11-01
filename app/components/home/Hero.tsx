"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Recycle, Store, Tag } from "lucide-react";
import { Button } from "@/app/components/shared/Button";
import { SmartImage } from "@/app/components/shared/SmartImage";
import { scrollToId } from "@/lib/scroll";
import { useCurrentUser } from "@/lib/current-user";
import { getSellerStoreSettings } from "@/lib/store-settings-storage";

const HERO_IMAGE =
  "https://images.pexels.com/photos/16134564/pexels-photo-16134564.jpeg?auto=compress&cs=tinysrgb&w=1200";

const SIDE_LINK =
  "inline-flex w-fit items-center gap-1.5 rounded-full font-sans text-[13px] font-semibold text-primary transition-colors duration-150 hover:text-primary-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Hero beranda pembeli.
 *
 * Satu panel utama berisi foto dan CTA, ditemani dua kartu ringkas berisi
 * pintasan ke flash sale dan daftar toko. Kartu samping sengaja bukan foto
 * berlapis overlay: teks di atas foto sulit dibaca dan setiap foto tambahan
 * menambah bobot muat awal halaman.
 */
export function Hero() {
  const router = useRouter();
  const { userId } = useCurrentUser();
  const [hasStore, setHasStore] = useState(false);

  /*
   * Sapaan dihitung setelah mount, bukan saat render server: jam harus mengikuti
   * perangkat pengguna. Tidak memakai timer — sapaan cukup akurat pada saat
   * halaman dibuka dan tidak perlu berubah sendiri.
   */
  const [greeting, setGreeting] = useState("Selamat datang");
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(
      hour < 11
        ? "Selamat pagi"
        : hour < 15
          ? "Selamat siang"
          : hour < 18
            ? "Selamat sore"
            : "Selamat malam",
    );
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const settings = await getSellerStoreSettings();
      if (mounted) setHasStore(!!settings);
    })();
    return () => {
      mounted = false;
    };
  }, [userId]);

  const handleMulaiJual = () => {
    if (!userId || !hasStore) {
      router.push("/auth/register/penjual");
    } else {
      router.push("/dashboard/penjual");
    }
  };

  return (
    <section
      id="home"
      data-nav="neutral"
      className="scroll-mt-20 bg-secondary px-4 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-6 lg:px-8 lg:pb-12"
    >
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:grid-rows-2 lg:gap-5">
        <div className="relative flex min-h-[360px] flex-col justify-between overflow-hidden rounded-2xl bg-primary lg:row-span-2 lg:min-h-[460px]">
          <div className="absolute inset-0">
            <SmartImage
              src={HERO_IMAGE}
              alt="Hidangan dari makanan surplus yang masih layak konsumsi"
              sizes="(min-width: 1024px) 60vw, 100vw"
              priority
            />
          </div>
          {/* Scrim warna solid (bukan gradient) agar teks tetap terbaca. */}
          <div aria-hidden className="absolute inset-0 bg-primary/85" />

          <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:p-10">
            {/*
              Header beranda: sapaan singkat + tautan kontekstual. Diletakkan di
              dalam panel hero (bukan baris terpisah) agar tidak ada blok judul
              besar yang mendorong konten penting ke bawah lipatan.
            */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 font-secondary text-[11px] font-semibold text-white/90">
                <span className="h-1.5 w-1.5 rounded-full bg-white/80" aria-hidden />
                {greeting}
              </span>
              <Link
                href="/riwayatPesanan"
                className="inline-flex items-center gap-1.5 rounded-full font-sans text-[12px] font-semibold text-white/80 transition-colors duration-150 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              >
                Pesanan saya
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>

            <div>
              <h1 className="max-w-xl font-sans text-[1.6rem] font-bold leading-[1.15] tracking-tight text-white sm:text-[2rem] lg:text-[2.4rem]">
                Temukan makanan surplus,
                <br className="hidden sm:block" /> hemat dan tetap nikmat
              </h1>
              <p className="mt-3 max-w-md font-secondary text-[13px] leading-relaxed text-white/85 sm:text-[15px]">
                Makanan surplus berkualitas dari UMKM di sekitarmu, dengan harga
                yang lebih bersahabat.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Button
                  variant="light"
                  size="sm"
                  onClick={() => scrollToId("rekomendasi")}
                  className="gap-2 px-5 py-2.5 text-[13px]"
                >
                  Jelajahi Makanan
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>

                <Button
                  variant="outlineLight"
                  size="sm"
                  onClick={handleMulaiJual}
                  className="px-5 py-2.5 text-[13px]"
                >
                  Mulai Jual
                </Button>
              </div>
            </div>

            <p className="flex items-center gap-2 font-secondary text-[11px] text-white/75 sm:text-xs">
              <Recycle className="h-4 w-4 text-white/80" aria-hidden />
              1000+ porsi makanan berhasil diselamatkan
            </p>
          </div>
        </div>

        <article className="flex flex-col justify-between gap-5 rounded-2xl border border-border bg-white p-5 sm:p-6">
          <div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
              <Tag className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <h2 className="mt-4 font-sans text-base font-bold tracking-tight text-foreground sm:text-[17px]">
              Diskon kilat hari ini
            </h2>
            <p className="mt-1.5 font-secondary text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
              Harga lebih hemat untuk makanan surplus pilihan, berganti setiap
              slot waktu.
            </p>
          </div>

          <button
            type="button"
            onClick={() => scrollToId("flashSale")}
            className={SIDE_LINK}
          >
            Lihat promo
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </article>

        <article className="flex flex-col justify-between gap-5 rounded-2xl border border-border bg-white p-5 sm:p-6">
          <div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
              <Store className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <h2 className="mt-4 font-sans text-base font-bold tracking-tight text-foreground sm:text-[17px]">
              Toko UMKM di sekitarmu
            </h2>
            <p className="mt-1.5 font-secondary text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
              Lihat toko lokal yang rutin menyelamatkan makanan surplusnya
              setiap hari.
            </p>
          </div>

          <Link href="/toko" className={SIDE_LINK}>
            Jelajahi toko
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </article>
      </div>
    </section>
  );
}
