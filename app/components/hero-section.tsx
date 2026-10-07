"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  ArrowRight,
  MapPin,
  Menu,
  Search,
  Star,
  Store,
  UtensilsCrossed,
  User,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import FoldText from "@/app/components/FoldText";
import RotatingText from "@/app/components/RotatingText";

const NAV_LINKS = [
  { href: "/#top", label: "Beranda", target: "top" },
  { href: "/#about", label: "Tentang", target: "about" },
  { href: "/#cara-kerja", label: "Cara Kerja", target: "cara-kerja" },
  { href: "/#langganan", label: "Langganan", target: "langganan" },
  { href: "/#testimoni", label: "Testimoni", target: "testimoni" },
  { href: "/#faq", label: "FAQ", target: "faq" },
];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const TRUST_ITEMS = [
  {
    icon: Star,
    value: "4.9/5",
    label: "Rating pembeli",
  },
  {
    icon: Store,
    value: "40+ UMKM",
    label: "Mitra Depok",
  },
  {
    icon: UtensilsCrossed,
    value: "1000+ porsi",
    label: "Diselamatkan",
  },
];

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
  const y = useTransform(scrollY, (value) => value * speedY);
  const x = useTransform(scrollY, (value) => value * speedX);

  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute z-0 overflow-hidden"
      style={{
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
        filter: `${blur ? `blur(${blur}px) ` : ""
          }saturate(1.35) brightness(0.96) contrast(1.1)`,
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
    {
      src: "/daun1072179.jpg",
      size: 208,
      top: "46%",
      left: "4%",
      radius: "0 100% 0 100%",
      rotate: 14,
      opacity: 0.7,
      blur: 0,
      speedY: -0.32,
      speedX: 0.09,
    },
    {
      src: "/daun1420019.jpg",
      size: 208,
      top: "48%",
      right: "4%",
      radius: "100% 0 100% 0",
      rotate: -16,
      opacity: 0.45,
      blur: 0.3,
      speedY: -0.36,
      speedX: -0.08,
    },
  ];

  const { scrollY } = useScroll();

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {leaves.map((leaf, index) => (
        <Leaf
          key={`${leaf.src}-${index}`}
          {...leaf}
          scrollY={scrollY}
        />
      ))}

      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white to-transparent" />
    </div>
  );
}

export function HeroSection() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState("Beranda");
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");

  const lang = "id" as "id" | "en";

  const t = (id: string, en: string) => {
    return lang === "en" ? en : id;
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const probeY = 128;

    let rafId: number | null = null;

    const update = () => {
      if (rafId !== null) return;

      rafId = requestAnimationFrame(() => {
        rafId = null;

        setScrolled(window.scrollY > 32);

        let label = NAV_LINKS[0].label;
        let bestTop = -Infinity;

        for (const link of NAV_LINKS) {
          const element = link.target
            ? document.getElementById(link.target)
            : null;

          if (!element) continue;

          const rect = element.getBoundingClientRect();

          if (
            rect.top <= probeY &&
            rect.bottom > probeY &&
            rect.top >= bestTop
          ) {
            label = link.label;
            bestTop = rect.top;
          }
        }

        setActiveNav(label);
      });
    };

    update();

    window.addEventListener("scroll", update, {
      passive: true,
    });

    window.addEventListener("resize", update);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }

      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [mounted]);

  const scrollToTarget = (target: string) => {
    const element = target
      ? document.getElementById(target)
      : null;

    if (!element) return;

    const lenis = window.__lenis;

    if (lenis) {
      lenis.scrollTo(element, {
        offset: -104,
        duration: 1.1,
      });
    } else {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const scrollToSection = (
    event: React.MouseEvent<HTMLAnchorElement>,
    label: string,
    target: string,
  ) => {
    event.preventDefault();

    setActiveNav(label);
    setOpen(false);

    scrollToTarget(target);
  };

  const handleSearchSubmit = (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const trimmed = query.trim();

    if (trimmed) {
      window.dispatchEvent(
        new CustomEvent("rebites:hero-search", {
          detail: trimmed,
        }),
      );
    }

    setActiveNav("Beranda");
    scrollToTarget("rekomendasi");
  };

  return (
    <div
      className="overflow-x-hidden bg-white"
      data-nav="neutral"
    >
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="px-4 pt-3 sm:px-6 sm:pt-4 lg:px-8">
          <div className="mx-auto w-full">
            <nav
              className={cn(
                "flex h-20 min-w-fit items-center justify-between px-5 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] sm:px-6 lg:px-8",
                scrolled
                  ? "mx-auto w-full max-w-4xl rounded-full border border-border/70 bg-white/90 px-6 text-primary shadow-[0_20px_44px_-26px_rgba(27,77,50,0.35)] backdrop-blur-xl sm:px-7 xl:max-w-5xl"
                  : "mx-auto w-full max-w-7xl rounded-none border-b border-transparent bg-transparent",
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

                <span className="font-display text-2xl font-medium tracking-tight text-primary">
                  <span className="font-display text-2xl font-medium">
                    Re
                  </span>

                  <span className="font-display text-2xl font-light italic">
                    Bites
                  </span>
                </span>
              </Link>

              <ul className="hidden items-center gap-5 lg:flex">
                {NAV_LINKS.map((link) => (
                  <li
                    key={link.label}
                    className="relative"
                  >
                    <Link
                      href={link.href}
                      onClick={(event) =>
                        scrollToSection(
                          event,
                          link.label,
                          link.target,
                        )
                      }
                      aria-current={
                        activeNav === link.label
                          ? "page"
                          : undefined
                      }
                      className={cn(
                        "relative py-1 font-secondary text-sm transition-colors duration-300",
                        activeNav === link.label
                          ? "font-semibold text-primary"
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
                    "hidden items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 font-secondary text-sm font-semibold text-white shadow-[0_14px_30px_-18px_rgba(27,77,50,0.65)] transition-all duration-300 hover:-translate-y-px hover:bg-primary-dark sm:flex",
                    FOCUS_RING,
                  )}
                >
                  <User className="h-3.5 w-3.5" />
                  {t("Masuk", "Log In")}
                </Link>

                <button
                  type="button"
                  onClick={() =>
                    setOpen((value) => !value)
                  }
                  aria-label={
                    open ? "Tutup menu" : "Buka menu"
                  }
                  aria-expanded={open}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center text-primary lg:hidden",
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
                  initial={{
                    opacity: 0,
                    y: -8,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  exit={{
                    opacity: 0,
                    y: -8,
                  }}
                  transition={{
                    duration: 0.25,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="mt-2 overflow-hidden rounded-3xl border border-border/70 bg-white p-3 shadow-[0_28px_56px_-28px_rgba(27,77,50,0.5)] lg:hidden"
                >
                  <ul className="flex flex-col">
                    {NAV_LINKS.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          onClick={(event) =>
                            scrollToSection(
                              event,
                              link.label,
                              link.target,
                            )
                          }
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
        className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-white px-4 pb-14 pt-28 sm:px-6 lg:px-8 lg:pt-28"
      >
        <HeroFoodBackdrop />

        <div className="relative z-10 w-full max-w-7xl">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-white px-5 py-2 shadow-[0_12px_26px_-14px_rgba(27,77,50,0.45)]">
              <MapPin className="h-3.5 w-3.5 text-primary" />

              <span className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                {t(
                  "Khusus Wilayah Kota Depok",
                  "Only in Depok City",
                )}
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
                style={{
                  fontStyle: "italic",
                }}
              />

              <div className="flex w-full items-baseline justify-center">
                <RotatingText
                  texts={[
                    "makanan.",
                    "UMKM.",
                    "masyarakat.",
                    "lingkungan.",
                  ]}
                  mainClassName="font-display font-light italic text-primary"
                  style={{
                    fontSize:
                      "clamp(2rem, 4.5vw, 3.5rem)",
                    lineHeight: 1.05,
                    letterSpacing: "-0.01em",
                  }}
                  rotationInterval={2200}
                  staggerDuration={0.03}
                  transition={{
                    type: "spring",
                    damping: 25,
                    stiffness: 300,
                  }}
                  exit={{
                    y: "-120%",
                    opacity: 0,
                  }}
                />
              </div>
            </div>

            <p className="mt-6 max-w-2xl font-sans text-base leading-[1.8] text-muted-foreground sm:text-lg">
              Nikmati makanan surplus berkualitas dari
              UMKM Kota Depok dengan harga lebih hemat,
              tetap layak konsumsi, dan tanpa membuang
              makanan.
            </p>

            <div className="mt-8 flex w-full flex-col items-center gap-5">
              <form
                role="search"
                aria-label="Cari makanan surplus"
                onSubmit={handleSearchSubmit}
                className="flex w-full max-w-xl items-center gap-2 rounded-full border border-border bg-white p-2 pl-4 shadow-[0_18px_40px_-24px_rgba(27,77,50,0.45)]"
              >
                <Search
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />

                <label
                  htmlFor="hero-search"
                  className="sr-only"
                >
                  Cari makanan surplus
                </label>

                <input
                  id="hero-search"
                  type="search"
                  value={query}
                  onChange={(event) =>
                    setQuery(event.target.value)
                  }
                  placeholder="Cari ayam geprek, soto mie, sate..."
                  autoComplete="off"
                  className="h-11 w-full bg-transparent font-inter text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                />

                <span className="hidden shrink-0 items-center gap-1 rounded-full border border-primary/10 bg-primary/5 px-3 py-1.5 font-inter text-xs font-semibold text-primary sm:inline-flex">
                  <MapPin
                    className="h-3.5 w-3.5 text-primary"
                    aria-hidden
                  />
                  Depok
                </span>

                <button
                  type="submit"
                  className={cn(
                    "group inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-primary px-6 font-inter text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-px hover:bg-primary-dark",
                    FOCUS_RING,
                  )}
                >
                  Cari
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </button>
              </form>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveNav("Beranda");
                    scrollToTarget("rekomendasi");
                  }}
                  className={cn(
                    "group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-inter text-sm font-semibold text-white shadow-[0_16px_32px_-16px_rgba(27,77,50,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary-dark",
                    FOCUS_RING,
                  )}
                >
                  Jelajahi Makanan

                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-primary shadow-sm transition-transform duration-300 group-hover:translate-x-0.5">
                    <ArrowRight
                      className="h-3.5 w-3.5"
                      aria-hidden
                    />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveNav("Cara Kerja");
                    scrollToTarget("cara-kerja");
                  }}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border border-primary/30 bg-white px-7 py-3.5 font-inter text-sm font-semibold text-primary transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:bg-primary/5",
                    FOCUS_RING,
                  )}
                >
                  Lihat Cara Kerja
                </button>
              </div>

              <dl className="mt-3 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
                {TRUST_ITEMS.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-2.5 text-left"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/15 bg-white text-primary shadow-sm">
                      <item.icon
                        className="h-4 w-4"
                        aria-hidden
                      />
                    </span>

                    <span>
                      <dt className="sr-only">
                        {item.label}
                      </dt>

                      <dd className="font-display text-sm font-bold leading-none text-primary">
                        {item.value}
                      </dd>

                      <dd className="mt-1 font-inter text-[11px] leading-none text-muted-foreground">
                        {item.label}
                      </dd>
                    </span>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}