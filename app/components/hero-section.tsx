"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, User, Menu, X, MapPin } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";
import FoldText from "@/app/components/FoldText";
import RotatingText from "@/app/components/RotatingText";

const NAV_LINKS = [
  { href: "/#top", label: "Beranda", target: "top" },
  { href: "/#about", label: "Tentang", target: "about" },
  { href: "/#rekomendasi", label: "Rekomendasi", target: "rekomendasi" },
  { href: "/#cara-kerja", label: "Cara Kerja", target: "cara-kerja" },
  { href: "/#langganan", label: "Langganan", target: "langganan" },
  { href: "/#testimoni", label: "Testimoni", target: "testimoni" },
  { href: "/#faq", label: "FAQ", target: "faq" },
];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function HeroSection() {
  const [open, setOpen] = useState<boolean>(false);
  const [scrolled, setScrolled] = useState<boolean>(false);
  const [activeNav, setActiveNav] = useState<string>("Beranda");
  const [overDark, setOverDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  const lang = "id" as "id" | "en";

  const t = (id: string, en: string): string => {
    return lang === "en" ? en : id;
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-nav]"),
    );

    if (sections.length === 0) {
      setOverDark(false);
      return;
    }

    const probeY = 128;

    // Coalesce scroll/resize events to one measurement pass per frame:
    // each pass reads ~8-21 getBoundingClientRect()s, which would otherwise
    // force layout on every scroll event (competing with Lenis' own rAF loop).
    let rafId: number | null = null;
    const update = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        setScrolled(window.scrollY > 32);

        let currentNav: string | undefined;
        for (const section of sections) {
          const rect = section.getBoundingClientRect();
          if (rect.top <= probeY && rect.bottom > probeY) {
            currentNav = section.dataset.nav;
            break;
          }
        }
        setOverDark(currentNav === "green");

        let label = NAV_LINKS[0].label;
        let bestTop = -Infinity;
        for (const link of NAV_LINKS) {
          const el = link.target
            ? document.getElementById(link.target)
            : null;
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          if (rect.top <= probeY && rect.bottom > probeY && rect.top >= bestTop) {
            label = link.label;
            bestTop = rect.top;
          }
        }
        setActiveNav(label);
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [mounted]);

  const navIsDark = mounted && overDark;

  const scrollToSection = (
    e: React.MouseEvent<HTMLAnchorElement>,
    label: string,
    target: string,
  ) => {
    e.preventDefault();
    setActiveNav(label);
    setOpen(false);
    const el = target ? document.getElementById(target) : null;
    if (!el) return;

    // `scrollIntoView` dengan perilaku smooth memakai animasi native browser
    // (compositor), bukan loop rAF JavaScript. Sebelumnya Lenis mengambil alih
    // seluruh scroll halaman dan menjalankan rAF terus-menerus — itulah sumber
    // scroll terasa "patah-patah" di perangkat lemah.
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="overflow-x-hidden bg-secondary" data-nav="neutral">
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="px-4 pt-3 sm:px-6 lg:px-8 sm:pt-4">
          <div className="mx-auto w-full">
            <nav
              className={cn(
                // `transition-all` dihapus: ia meng-animasikan SEMUA properti,
                // termasuk yang memaksa raster ulang. Properti yang benar-benar
                // berubah hanya warna, border, dan bayangan.
                "flex h-20 min-w-fit items-center justify-between px-5 transition-[background-color,border-color,box-shadow,color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:px-6 lg:px-8",
                scrolled
                  ? cn(
                      // `backdrop-blur-xl` dihapus. Elemen sticky yang memakai
                      // backdrop-filter harus mengambil sampel ulang isi di
                      // belakangnya SETIAP frame scroll — inilah penyebab
                      // utama scroll terasa patah-patah. Latar dibuat sedikit
                      // lebih pekat supaya keterbacaan tetap sama.
                      "mx-auto w-full max-w-4xl rounded-full border px-6 shadow-[0_20px_44px_-26px_rgba(27,77,50,0.45)] sm:px-7 xl:max-w-5xl",
                      navIsDark
                        ? "border-white/15 bg-primary/95 text-white"
                        : "border-hairline/70 bg-white/95 text-primary",
                    )
                  : cn(
                      "mx-auto w-full max-w-7xl rounded-none border-b border-transparent bg-transparent",
                    ),
              )}
            >
              <Link
                href="/"
                aria-label="ReBites"
                className="flex shrink-0 items-center gap-2.5"
              >
                <Image
                  src="/logo.png"
                  alt="ReBites"
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full object-cover"
                />

                <span
                  className={cn(
                    "font-display text-2xl font-medium tracking-tight transition-colors duration-500",
                    navIsDark ? "text-white" : "text-primary",
                  )}
                >
                  <span className="font-display text-2xl font-medium">Re</span>
                  <span className="font-display text-2xl font-light italic">
                    Bites
                  </span>
                </span>
              </Link>

              <ul className="hidden items-center gap-5 lg:flex">
                {NAV_LINKS.map((link) => (
                  <li key={link.label} className="relative">
                    <Link
                      href={link.href}
                      onClick={(e) => scrollToSection(e, link.label, link.target)}
                      aria-current={
                        activeNav === link.label ? "page" : undefined
                      }
                      className={cn(
                        "relative py-1 font-secondary text-sm transition-colors duration-300",
                        activeNav === link.label
                          ? navIsDark
                            ? "font-semibold text-white"
                            : "font-semibold text-primary"
                          : navIsDark
                            ? "text-white/80 hover:text-white"
                            : "text-primary/80 hover:text-primary",
                      )}
                    >
                      {link.label}

                      {activeNav === link.label && (
                        <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-primary" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-4">
                <Link
                  href="/auth/login"
                  className={cn(
                    "hidden items-center gap-1.5 rounded-full px-5 py-2.5 font-secondary text-sm font-semibold shadow-[0_14px_30px_-18px_rgba(27,77,50,0.65)] transition-colors duration-300 sm:flex",
                    navIsDark
                      ? "bg-white text-primary hover:bg-primary-dark hover:text-white"
                      : "bg-primary text-white hover:bg-primary-dark hover:text-white",
                    FOCUS_RING,
                  )}
                >
                  <User className="h-3.5 w-3.5" />
                  {t("Masuk", "Log In")}
                </Link>

                <button
                  type="button"
                  onClick={() => setOpen((value) => !value)}
                  aria-label={open ? "Tutup menu" : "Buka menu"}
                  aria-expanded={open}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center lg:hidden",
                    navIsDark ? "text-white" : "text-primary",
                    FOCUS_RING,
                  )}
                >
                  {open ? (
                    <X className="h-6 w-6" />
                  ) : (
                    <Menu className="h-6 w-6" />
                  )}
                </button>
              </div>
            </nav>

            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-2 overflow-hidden rounded-3xl border border-border/70 bg-white p-3 shadow-[0_28px_56px_-28px_rgba(27,77,50,0.5)] lg:hidden"
                >
                  <ul className="flex flex-col">
                    {NAV_LINKS.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          onClick={(e) => scrollToSection(e, link.label, link.target)}
                          className={cn(
                            "flex items-center justify-between rounded-2xl px-4 py-3 font-secondary text-sm transition-colors duration-300",
                            activeNav === link.label
                              ? "bg-primary/10 font-semibold text-primary"
                              : "text-primary hover:bg-secondary",
                          )}
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-2 flex border-t border-border/70 pt-3">
                    <Link
                      href="/auth/login"
                      onClick={() => setOpen(false)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3 font-secondary text-sm font-semibold text-white transition-colors duration-300 hover:bg-primary-dark"
                    >
                      <User className="h-3.5 w-3.5" />
                      {t("Masuk", "Log In")}
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      <section
        id="top"
        className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-secondary px-4 pb-14 pt-28 sm:px-6 lg:px-8 lg:pt-28"
      >
        <HeroFoodBackdrop />

        <div className="relative w-full max-w-7xl">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/60 bg-white px-5 py-2 shadow-[0_12px_26px_-14px_rgba(27,77,50,0.65)]">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {t("Khusus Wilayah Kota Depok", "Only in Depok City")}
              </span>
            </div>

            <div className="flex w-full flex-col items-center">
              <FoldText
                text="Ubah cara Anda menyelamatkan"
                hinge="top"
                trigger="load"
                duration={1.15}
                stagger={0.03}
                ease="expo.out"
                perspective={600}
                creaseShading={0}
                as="h1"
                fontSize="clamp(2rem, 4.5vw, 3.5rem)"
                fontWeight={600}
                lineHeight={1.05}
                letterSpacing="-0.02em"
                className="text-primary"
                style={{ fontStyle: "italic" }}
              />
              <div className="flex w-full items-baseline justify-center">
                <RotatingText
                  texts={["makanan.", "UMKM.", "masyarakat.", "lingkungan."]}
                  mainClassName="font-display font-light italic text-primary"
                  style={{
                    fontSize: "clamp(2rem, 4.5vw, 3.5rem)",
                    lineHeight: 1.05,
                    letterSpacing: "-0.01em",
                  }}
                  rotationInterval={2200}
                  staggerDuration={0.03}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  exit={{ y: "-120%", opacity: 0 }}
                />
              </div>
            </div>

            <p className="mt-6 max-w-2xl font-sans text-base leading-[1.8] text-muted-foreground sm:text-lg">
              Nikmati makanan surplus berkualitas dari UMKM Kota Depok dengan
              harga lebih hemat, tetap layak konsumsi, dan tanpa membuang
              makanan.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
              <Link
                href="/auth/register"
                className={cn(
                  "group inline-flex items-center gap-2 rounded-full bg-primary px-9 py-4 font-secondary text-base font-semibold text-white shadow-[0_16px_32px_-16px_rgba(27,77,50,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary-dark",
                  FOCUS_RING,
                )}
              >
                Mulai Sekarang
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-primary-dark shadow-sm transition-all duration-300 group-hover:translate-x-1">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>

              <div className="flex flex-col items-center leading-none">
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg
                        key={i}
                        className="h-4 w-4 fill-primary text-primary"
                        viewBox="0 0 20 20"
                        aria-hidden
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="font-sans text-sm font-bold leading-none text-primary-dark">
                    5.0
                  </span>
                </div>
                <span className="font-sans text-[11px] font-medium leading-none text-primary-dark/70">
                  dari 500+ ulasan
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

type LeafProps = {
  src: string;
  size: number;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
  rotate: number;
  opacity: number;
  blur?: number;
  speedY: number;
  speedX: number;
  radius: string;
  /** Satu `useScroll()` dipakai bersama oleh semua daun. */
  scrollY: MotionValue<number>;
};

function Leaf({
  src,
  size,
  top,
  left,
  right,
  bottom,
  rotate,
  opacity,
  blur,
  speedY,
  speedX,
  radius,
  scrollY,
}: LeafProps) {
  // transform-only (no layout/repaint), di-subscribe dari satu scroll value
  // bersama alih-alih 6 listener window terpisah.
  const y = useTransform(scrollY, (v) => v * speedY);
  const x = useTransform(scrollY, (v) => v * speedX);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none z-0 overflow-hidden"
      style={{
        position: "absolute",
        top,
        left,
        right,
        bottom,
        width: size,
        height: size,
        y,
        x,
        rotate,
        opacity,
        // blur dihapus: filter blur pada elemen besar adalah efek termahal di GPU,
        // dan 6 daun berarti 6 filter aktif selama hero terlihat.
        filter: "saturate(1.35) brightness(0.96) contrast(1.1)",
        borderRadius: radius,
      }}
    >
      <Image
        src={src}
        alt=""
        fill
        sizes="(max-width: 640px) 256px, 384px"
        fetchPriority="low"
        className="object-cover"
      />
    </motion.div>
  );
}

function HeroFoodBackdrop() {
  const leaves = [
    {
      src: "/daun797797.jpg",
      size: 320,
      top: "-40px",
      left: "-70px",
      radius: "100% 0 100% 0",
      rotate: -35,
      opacity: 0.8,
      blur: 0,
      speedY: -0.12,
      speedX: 0.04,
    },
    {
      src: "/daun797797.jpg",
      size: 288,
      top: "-44px",
      right: "-70px",
      radius: "0 100% 0 100%",
      rotate: 32,
      opacity: 0.5,
      blur: 0.5,
      speedY: -0.18,
      speedX: -0.04,
    },
    {
      src: "/daun1420019.jpg",
      size: 300,
      bottom: "24px",
      left: "-56px",
      radius: "0 100% 0 100%",
      rotate: 28,
      opacity: 0.8,
      blur: 0,
      speedY: -0.24,
      speedX: 0.06,
    },
    {
      src: "/daun1072179.jpg",
      size: 272,
      bottom: "24px",
      right: "-56px",
      radius: "100% 0 100% 0",
      rotate: -30,
      opacity: 0.5,
      blur: 0.4,
      speedY: -0.2,
      speedX: -0.05,
    },
      // Dua daun kecil dihapus saat optimasi: tiap daun = 1 motion.div dengan
      // transform scroll aktif; 4 daun memberi komposisi yang sama dengan beban lebih ringan.
  ];

  // Satu subscription scroll untuk 6 daun parallax, bukan satu per daun.
  const { scrollY } = useScroll();

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {leaves.map((leaf, i) => (
        <Leaf key={`${leaf.src}-${i}`} {...leaf} scrollY={scrollY} />
      ))}

      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-secondary to-transparent" />
    </div>
  );
}

