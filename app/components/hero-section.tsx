"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  User,
  Menu,
  X,
  MapPin,
  Search,
  Star,
  Store,
  UtensilsCrossed,
  Leaf,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { RevealItem, RevealStagger } from "@/app/components/reveal";
import {
  FloatingDishCard,
  type FloatingDish,
} from "@/app/components/hero-floating-card";

const NAV_LINKS = [
  { href: "/#top", label: "Beranda", target: "top" },
  { href: "/#rekomendasi", label: "Rekomendasi", target: "rekomendasi" },
  { href: "/#about", label: "Tentang", target: "about" },
  { href: "/#cara-kerja", label: "Cara Kerja", target: "cara-kerja" },
  { href: "/#langganan", label: "Langganan", target: "langganan" },
  { href: "/#testimoni", label: "Testimoni", target: "testimoni" },
  { href: "/#faq", label: "FAQ", target: "faq" },
];

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const FLOATING_DISHES: FloatingDish[] = [
  {
    name: "Ayam Geprek",
    merchant: "Warung Geprek Bu Ati",
    image: "/makanan1.jpeg",
    price: 12000,
    originalPrice: 15000,
    rating: "4.9",
    meta: "Sisa 12 porsi",
    metaTone: "stock",
  },
  {
    name: "Soto Mie Bogor",
    merchant: "Soto Mie Mang Aji",
    image: "/makanan3.jpeg",
    price: 18000,
    originalPrice: 22000,
    rating: "4.8",
    meta: "-18% Flash",
    metaTone: "flash",
  },
];

const TRUST_ITEMS = [
  { icon: Star, value: "4.9/5", label: "Rating pembeli" },
  { icon: Store, value: "40+ UMKM", label: "Mitra Depok" },
  { icon: UtensilsCrossed, value: "1000+ porsi", label: "Diselamatkan" },
];

export function HeroSection() {
  const [open, setOpen] = useState<boolean>(false);
  const [scrolled, setScrolled] = useState<boolean>(false);
  const [activeNav, setActiveNav] = useState<string>("Beranda");
  const [overDark, setOverDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");

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

    const update = () => {
      setScrolled(window.scrollY > 32);

      const current = sections.find((section) => {
        const rect = section.getBoundingClientRect();
        return rect.top <= probeY && rect.bottom > probeY;
      });

      setOverDark(current?.dataset.nav === "green");

      let label = NAV_LINKS[0].label;
      let labelTarget: HTMLElement | null = null;
      for (const link of NAV_LINKS) {
        const el = link.target
          ? document.getElementById(link.target)
          : null;
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top <= probeY && rect.bottom > probeY) {
          if (!labelTarget || rect.top >= labelTarget.getBoundingClientRect().top) {
            label = link.label;
            labelTarget = el;
          }
        }
      }
      setActiveNav(label);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [mounted]);

  const navIsDark = mounted && overDark;

  const scrollToTarget = (target: string) => {
    const el = target ? document.getElementById(target) : null;
    if (!el) return;

    const lenis = window.__lenis;
    if (lenis) lenis.scrollTo(el, { offset: -104, duration: 1.1 });
    else el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToSection = (
    e: React.MouseEvent<HTMLAnchorElement>,
    label: string,
    target: string,
  ) => {
    e.preventDefault();
    setActiveNav(label);
    setOpen(false);
    scrollToTarget(target);
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      window.dispatchEvent(
        new CustomEvent("rebites:hero-search", { detail: trimmed }),
      );
    }
    setActiveNav("Rekomendasi");
    scrollToTarget("rekomendasi");
  };

  return (
    <div className="overflow-x-hidden bg-cream" data-nav="cream">
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="px-4 pt-3 sm:px-6 lg:px-8 sm:pt-4">
          <div className="mx-auto w-full">
            <nav
              className={cn(
                "flex h-20 min-w-fit items-center justify-between px-5 transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] sm:px-6 lg:px-8",
                scrolled
                  ? cn(
                      "mx-auto w-full max-w-4xl rounded-full border px-6 shadow-[0_20px_44px_-26px_rgba(27,77,50,0.45)] backdrop-blur-xl sm:px-7 xl:max-w-5xl",
                      navIsDark
                        ? "border-white/15 bg-primary/70 text-white"
                        : "border-hairline/70 bg-white/85 text-primary",
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
                        "relative py-1 font-inter text-sm transition-colors duration-300",
                        activeNav === link.label
                          ? navIsDark
                            ? "font-semibold text-white"
                            : "font-semibold text-primary"
                          : navIsDark
                            ? "text-white/80 hover:text-white"
                            : "text-primary/80 hover:text-caramel",
                      )}
                    >
                      {link.label}

                      {activeNav === link.label && (
                        <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-caramel" />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-4">
                <Link
                  href="/auth/login"
                  className={cn(
                    "hidden items-center gap-1.5 rounded-full px-5 py-2.5 font-inter text-sm font-semibold shadow-[0_14px_30px_-18px_rgba(27,77,50,0.65)] transition-colors duration-300 sm:flex",
                    navIsDark
                      ? "bg-white text-primary hover:bg-caramel hover:text-white"
                      : "bg-primary text-white hover:bg-caramel hover:text-white",
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
                    navIsDark ? "text-white" : "text-forest",
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
                  className="mt-2 overflow-hidden rounded-3xl border border-hairline/70 bg-white p-3 shadow-[0_28px_56px_-28px_rgba(27,77,50,0.5)] lg:hidden"
                >
                  <ul className="flex flex-col">
                    {NAV_LINKS.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          onClick={(e) => scrollToSection(e, link.label, link.target)}
                          className={cn(
                            "flex items-center justify-between rounded-2xl px-4 py-3 font-inter text-sm transition-colors duration-300",
                            activeNav === link.label
                              ? "bg-caramel/10 font-semibold text-primary"
                              : "text-primary hover:bg-cream",
                          )}
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-2 flex border-t border-hairline/70 pt-3">
                    <Link
                      href="/auth/login"
                      onClick={() => setOpen(false)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary py-3 font-inter text-sm font-semibold text-white transition-colors duration-300 hover:bg-caramel"
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
        className="grain-overlay relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-cream px-4 pb-14 pt-28 sm:px-6 lg:px-8 lg:pt-32"
      >
        <HeroBackdrop />

        <FloatingDishCard
          dish={FLOATING_DISHES[0]}
          priority
          delay={0.45}
          drift={10}
          duration={7}
          className="absolute left-[max(1rem,calc(50%-36rem))] top-[24%] z-10 hidden rotate-[-6deg] xl:block"
        />
        <FloatingDishCard
          dish={FLOATING_DISHES[1]}
          delay={0.6}
          drift={12}
          duration={8}
          className="absolute right-[max(1rem,calc(50%-36rem))] top-[30%] z-10 hidden rotate-[5deg] xl:block"
        />

        <RevealStagger
          stagger={0.09}
          delay={0.05}
          className="relative z-20 mx-auto flex w-full max-w-3xl flex-col items-center text-center"
        >
          <RevealItem>
            <p className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full border border-primary/25 bg-white/80 px-4 py-2 font-inter text-[11px] font-semibold uppercase tracking-[0.18em] text-primary shadow-[0_12px_26px_-18px_rgba(27,77,50,0.6)] backdrop-blur">
              <MapPin className="h-3.5 w-3.5 text-caramel" aria-hidden />
              Khusus Wilayah Kota Depok
              <span aria-hidden className="h-1 w-1 rounded-full bg-caramel" />
              <Leaf className="h-3.5 w-3.5 text-primary" aria-hidden />
              1000+ porsi diselamatkan
            </p>
          </RevealItem>

          <RevealItem>
            <h1 className="mt-6 font-display text-[clamp(2.4rem,6vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-primary">
              Selamatkan Makanan Enak,
              <span className="mt-1 block font-light italic text-caramel">
                Hemat hingga 60%
              </span>
            </h1>
          </RevealItem>

          <RevealItem>
            <p className="mx-auto mt-5 max-w-xl font-inter text-sm leading-[1.8] text-muted-foreground sm:text-base">
              Makanan surplus berkualitas dari UMKM Depok — tetap layak
              konsumsi, harga lebih hemat, tanpa ada yang terbuang.
            </p>
          </RevealItem>

          <RevealItem className="w-full">
            <form
              role="search"
              aria-label="Cari makanan surplus"
              onSubmit={handleSearchSubmit}
              className="mx-auto mt-7 flex w-full max-w-xl items-center gap-2 rounded-full border border-hairline bg-white/90 p-2 pl-4 shadow backdrop-blur"
            >
              <Search
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <label htmlFor="hero-search" className="sr-only">
                Cari makanan surplus
              </label>
              <input
                id="hero-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari ayam geprek, soto mie, sate..."
                autoComplete="off"
                className="h-11 w-full bg-transparent font-inter text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
              />
              <span className="hidden shrink-0 items-center gap-1 rounded-full bg-cream-100 px-3 py-1.5 font-inter text-xs font-semibold text-primary sm:inline-flex">
                <MapPin className="h-3.5 w-3.5 text-caramel" aria-hidden />
                Depok
              </span>
              <button
                type="submit"
                className={cn(
                  "inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-primary px-5 font-inter text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-px hover:bg-caramel sm:px-6",
                  FOCUS_RING,
                )}
              >
                Cari
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </form>
          </RevealItem>

          <RevealItem>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setActiveNav("Rekomendasi");
                  scrollToTarget("rekomendasi");
                }}
                className={cn(
                  "group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 font-inter text-sm font-semibold text-white shadow transition-all duration-300 hover:-translate-y-0.5 hover:bg-caramel",
                  FOCUS_RING,
                )}
              >
                Jelajahi Makanan
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-forest-dark shadow-sm transition-transform duration-300 group-hover:translate-x-0.5">
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveNav("Cara Kerja");
                  scrollToTarget("cara-kerja");
                }}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border border-primary/30 bg-white/70 px-7 py-3.5 font-inter text-sm font-semibold text-primary backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:border-caramel hover:text-caramel-dark",
                  FOCUS_RING,
                )}
              >
                Lihat Cara Kerja
              </button>
            </div>
          </RevealItem>

          <RevealItem>
            <dl className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {TRUST_ITEMS.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5 text-left"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-white text-caramel shadow-sm">
                    <item.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span>
                    <dt className="sr-only">{item.label}</dt>
                    <dd className="font-display text-sm font-bold leading-none text-forest-dark">
                      {item.value}
                    </dd>
                    <dd className="mt-1 font-inter text-[11px] leading-none text-muted-foreground">
                      {item.label}
                    </dd>
                  </span>
                </div>
              ))}
            </dl>
          </RevealItem>
        </RevealStagger>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.7, ease: EASE }}
          className="relative z-20 mt-8 flex w-full max-w-3xl gap-3 overflow-x-auto pb-2 xl:hidden"
        >
          {FLOATING_DISHES.map((dish) => (
            <FloatingDishCard
              key={dish.name}
              dish={dish}
              className="w-56 shrink-0"
              drift={0}
              duration={1}
              delay={0}
            />
          ))}
          <div className="flex w-56 shrink-0 flex-col justify-center rounded-3xl border border-dashed border-caramel/60 bg-white/60 p-4 text-left backdrop-blur">
            <p className="font-display text-sm font-semibold text-primary">
              -30% Flash Sale
            </p>
            <p className="mt-1 font-inter text-xs leading-relaxed text-muted-foreground">
              Diskon kilat setiap hari untuk menu pilihan di sekitarmu.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveNav("Rekomendasi");
                scrollToTarget("rekomendasi");
              }}
              className={cn(
                "mt-3 inline-flex w-fit items-center gap-1.5 font-inter text-xs font-semibold text-caramel-dark hover:text-caramel",
                FOCUS_RING,
              )}
            >
              Lihat promo
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </motion.div>
      </section>
    </div>
  );
}

function HeroBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <div className="absolute left-1/2 top-[-12rem] h-[28rem] w-[46rem] -translate-x-1/2 rounded-full bg-caramel/25 blur-3xl" />
      <div className="absolute -left-40 top-1/3 h-[22rem] w-[22rem] rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-40 top-1/4 h-[24rem] w-[24rem] rounded-full bg-primary/10 blur-3xl" />
      <svg
        viewBox="0 0 1440 220"
        preserveAspectRatio="none"
        className="absolute inset-x-0 top-16 h-40 w-full text-primary opacity-[0.16]"
      >
        <path
          d="M -40 150 C 240 70, 480 190, 740 120 C 990 55, 1200 160, 1480 80"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M -40 175 C 250 100, 490 210, 750 145 C 1000 85, 1210 180, 1480 105"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-cream to-transparent" />
    </div>
  );
}
