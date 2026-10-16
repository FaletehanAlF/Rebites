"use client";

import { motion, type Variants } from "framer-motion";
import { ArrowRight, Recycle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/shared/Button";
import { SmartImage } from "@/app/components/shared/SmartImage";
import { scrollToId } from "@/lib/scroll";
import { useCurrentUser } from "@/lib/current-user";
import { getSellerStoreSettings } from "@/lib/store-settings-storage";
import { useEffect, useState } from "react";

const HERO_IMAGE =
  "https://images.pexels.com/photos/16134564/pexels-photo-16134564.jpeg?auto=compress&cs=tinysrgb&w=1200";
const UMKM_IMAGE =
  "https://images.pexels.com/photos/2696064/pexels-photo-2696064.jpeg?auto=compress&cs=tinysrgb&w=800";

const container: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.1 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

export function Hero() {
  const router = useRouter();
  const { userId } = useCurrentUser();
  const [hasStore, setHasStore] = useState(false);

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
      className="relative overflow-hidden scroll-mt-20 bg-secondary px-4 pb-10 pt-16 sm:px-6 lg:px-8 lg:pb-24 lg:pt-28"
    >
      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="relative mx-auto grid max-w-7xl gap-4 sm:gap-6 lg:grid-cols-[1.85fr_1fr] lg:gap-7"
      >
        <motion.div
          variants={item}
          className="relative min-h-[320px] overflow-hidden rounded-2xl sm:min-h-[400px] lg:min-h-[640px]"
        >
          <div className="absolute inset-0">
            <SmartImage
              src={HERO_IMAGE}
              alt="Hidangan dari makanan surplus yang masih layak konsumsi"
              sizes="(min-width: 1024px) 60vw, 100vw"
              priority
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-primary/95 via-primary to-primary/25" />

          <div className="relative flex h-full flex-col justify-end p-6 sm:p-10 lg:p-14">
            <h1 className="max-w-2xl font-sans text-2xl font-semibold leading-[1.05] tracking-tight text-primary-foreground sm:text-4xl lg:text-[3.85rem]">
              Temukan Makanan Surplus,
              <br className="hidden sm:block" />
              <span className="relative inline-block">
                Hemat dan Nikmat
                <span className="absolute inset-x-0 -bottom-1 h-[3px] rounded-full bg-primary sm:-bottom-2" />
              </span>
            </h1>
            <p className="mt-3 max-w-lg font-secondary text-xs leading-relaxed text-white sm:mt-5 sm:text-[15px] lg:text-[16px]">
              Temukan makanan surplus berkualitas dari UMKM di sekitarmu dengan
              harga lebih bersahabat.
            </p>

            <div className="mt-5 sm:mt-8">
              <Button
                variant="outlineLight"
                size="sm"
                onClick={() => scrollToId("rekomendasi")}
                className="group px-5 py-2.5 text-[12px] sm:scale-105 sm:px-7 sm:py-3.5 sm:text-[13px] lg:scale-110 lg:px-8"
              >
                Jelajahi Makanan
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            <p className="mt-3 flex items-center gap-2 font-secondary text-[11px] text-primary-foreground/75 sm:mt-5 sm:text-sm">
              <Recycle className="h-3.5 w-3.5 text-primary-foreground sm:h-4 sm:w-4" />
              1000+ porsi makanan berhasil diselamatkan
            </p>
          </div>
        </motion.div>

        <div className="grid gap-3 sm:gap-4 lg:gap-6">
          <motion.div
            variants={item}
            className="group relative overflow-hidden rounded-2xl"
          >
            <div className="absolute inset-0">
              <SmartImage
                src="/hero-makanan.jpeg"
                alt="Makanan surplus diskon besar"
                sizes="(min-width: 1024px) 40vw, 100vw"
              />
            </div>
            <div className="absolute inset-0 bg-primary/80 transition-colors duration-300 group-hover:bg-primary-dark/70" />

            <div className="relative flex h-full flex-col justify-end p-4 sm:p-6 lg:p-8">
              <h2 className="mt-3 font-sans text-lg font-semibold leading-snug text-primary-foreground sm:mt-4 sm:text-2xl lg:text-[1.7rem]">
                Diskon Kilat,
                <br />
                Hemat Besar.
              </h2>
              <p className="mt-1.5 max-w-[260px] font-secondary text-xs leading-relaxed text-primary-foreground/80 sm:mt-2 sm:text-sm">
                Dapatkan diskon spesial untuk makanan favoritmu sekarang.
              </p>
              <Button
                variant="outlineLight"
                size="sm"
                className="mt-3 sm:mt-5"
                onClick={() => scrollToId("flashSale")}
              >
                Lihat Promo
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>

          <motion.div
            variants={item}
            className="group relative overflow-hidden rounded-2xl"
          >
            <div className="absolute inset-0">
              <SmartImage
                src={UMKM_IMAGE}
                alt="Pelaku UMKM menyiapkan bahan makanan di dapur"
                sizes="(min-width: 1024px) 40vw, 100vw"
              />
            </div>
            <div className="absolute inset-0 bg-primary/80 transition-colors duration-300 group-hover:bg-primary-dark/70" />

            <div className="relative flex h-full flex-col justify-end p-4 sm:p-6 lg:p-8">
              <h2 className="mt-2 font-sans text-base font-semibold text-primary-foreground sm:mt-3 sm:text-xl lg:text-2xl">
                Punya Makanan Surplus?
              </h2>
              <p className="mt-1 max-w-[260px] font-secondary text-xs leading-relaxed text-primary-foreground/80 sm:mt-1.5 sm:text-sm">
                Jual sekarang dengan harga diskon dan ubah sisa jadi pemasukan.
              </p>
              <Button
                variant="outlineLight"
                size="sm"
                className="mt-3 sm:mt-5"
                onClick={handleMulaiJual}
              >
                Mulai Jual
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
