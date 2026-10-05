"use client";

import Image from "next/image";
import { useEffect, useState, useId } from "react";
import Link from "next/link";
import { ArrowRight, User, Menu, X, MapPin } from "lucide-react";
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
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
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caramel focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

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

    const lenis = window.__lenis;
    if (lenis) lenis.scrollTo(el, { offset: -104, duration: 1.1 });
    else el.scrollIntoView({ behavior: "smooth", block: "start" });
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
        className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-cream px-4 pb-14 pt-28 sm:px-6 lg:px-8 lg:pt-28"
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
                  mainClassName="font-display font-light italic text-caramel"
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
                  "group inline-flex items-center gap-2 rounded-full bg-primary px-9 py-4 font-inter text-base font-semibold text-white shadow-[0_16px_32px_-16px_rgba(27,77,50,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-caramel",
                  FOCUS_RING,
                )}
              >
                Mulai Sekarang
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-forest-dark shadow-sm transition-all duration-300 group-hover:translate-x-1">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>

              <div className="flex flex-col items-center leading-none">
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg
                        key={i}
                        className="h-4 w-4 fill-caramel text-caramel"
                        viewBox="0 0 20 20"
                        aria-hidden
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                  <span className="font-sans text-sm font-bold leading-none text-forest-dark">
                    5.0
                  </span>
                </div>
                <span className="font-sans text-[11px] font-medium leading-none text-forest-dark/70">
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

function HeroOrganicArt() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1440 560"
      preserveAspectRatio="none"
      className="
        pointer-events-none
        absolute
        left-1/2
        top-[90px]
        z-0
        h-[470px]
        w-screen
        -translate-x-1/2
        overflow-visible
        text-forest
        opacity-50
      "
    >
      <g
        fill="none"
        stroke="hsl(var(--primary))"
        strokeOpacity="0.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="
            M -220 330
            C -40 220, 120 175, 300 215
            C 465 252, 545 350, 700 330
            C 850 310, 925 190, 1080 175
            C 1245 160, 1370 220, 1660 70
          "
          strokeWidth="2.8"
          opacity="0.72"
        />

        <path
          d="
            M -220 365
            C -35 255, 125 215, 305 248
            C 470 280, 560 375, 710 355
            C 855 335, 935 220, 1090 205
            C 1250 188, 1380 245, 1660 105
          "
          strokeWidth="1.7"
          opacity="0.52"
        />

        <path
          d="
            M -220 393
            C -30 290, 140 252, 315 278
            C 485 305, 570 397, 720 380
            C 870 363, 950 250, 1100 235
            C 1265 218, 1395 265, 1660 135
          "
          strokeWidth="1"
          opacity="0.34"
        />

        {/* Hanging stems, each with 3 leaves hanging below the top thread */}

        {/* Stem 1 */}
        <path
          d="M 160 4 C 158 30, 161 62, 160 98"
          strokeWidth="2.6"
          opacity="0.6"
        />
        <ellipse
          cx="160"
          cy="124"
          rx="9"
          ry="27"
          transform="rotate(0 160 124)"
          strokeWidth="2"
          opacity="0.6"
        />
        <ellipse
          cx="143"
          cy="108"
          rx="8"
          ry="22"
          transform="rotate(-45 143 108)"
          strokeWidth="2"
          opacity="0.55"
        />
        <ellipse
          cx="177"
          cy="108"
          rx="8"
          ry="22"
          transform="rotate(45 177 108)"
          strokeWidth="2"
          opacity="0.5"
        />

        {/* Stem 2 */}
        <path
          d="M 360 8 C 362 34, 359 66, 360 102"
          strokeWidth="2.6"
          opacity="0.6"
        />
        <ellipse
          cx="360"
          cy="128"
          rx="9"
          ry="27"
          transform="rotate(0 360 128)"
          strokeWidth="2"
          opacity="0.6"
        />
        <ellipse
          cx="343"
          cy="112"
          rx="8"
          ry="22"
          transform="rotate(-45 343 112)"
          strokeWidth="2"
          opacity="0.55"
        />
        <ellipse
          cx="377"
          cy="112"
          rx="8"
          ry="22"
          transform="rotate(45 377 112)"
          strokeWidth="2"
          opacity="0.5"
        />

        {/* Stem 3 */}
        <path
          d="M 565 4 C 567 30, 564 60, 565 96"
          strokeWidth="2.6"
          opacity="0.6"
        />
        <ellipse
          cx="565"
          cy="120"
          rx="9"
          ry="27"
          transform="rotate(0 565 120)"
          strokeWidth="2"
          opacity="0.6"
        />
        <ellipse
          cx="548"
          cy="105"
          rx="8"
          ry="22"
          transform="rotate(-45 548 105)"
          strokeWidth="2"
          opacity="0.55"
        />
        <ellipse
          cx="582"
          cy="105"
          rx="8"
          ry="22"
          transform="rotate(45 582 105)"
          strokeWidth="2"
          opacity="0.5"
        />

        {/* Stem 4 */}
        <path
          d="M 770 10 C 768 34, 771 62, 770 98"
          strokeWidth="2.6"
          opacity="0.6"
        />
        <ellipse
          cx="770"
          cy="124"
          rx="9"
          ry="27"
          transform="rotate(0 770 124)"
          strokeWidth="2"
          opacity="0.6"
        />
        <ellipse
          cx="753"
          cy="108"
          rx="8"
          ry="22"
          transform="rotate(-45 753 108)"
          strokeWidth="2"
          opacity="0.55"
        />
        <ellipse
          cx="787"
          cy="108"
          rx="8"
          ry="22"
          transform="rotate(45 787 108)"
          strokeWidth="2"
          opacity="0.5"
        />

        {/* Stem 5 */}
        <path
          d="M 985 6 C 987 32, 984 62, 985 100"
          strokeWidth="2.6"
          opacity="0.6"
        />
        <ellipse
          cx="985"
          cy="126"
          rx="9"
          ry="27"
          transform="rotate(0 985 126)"
          strokeWidth="2"
          opacity="0.6"
        />
        <ellipse
          cx="968"
          cy="110"
          rx="8"
          ry="22"
          transform="rotate(-45 968 110)"
          strokeWidth="2"
          opacity="0.55"
        />
        <ellipse
          cx="1002"
          cy="110"
          rx="8"
          ry="22"
          transform="rotate(45 1002 110)"
          strokeWidth="2"
          opacity="0.5"
        />

        {/* Stem 6 */}
        <path
          d="M 1200 10 C 1202 34, 1199 62, 1200 96"
          strokeWidth="2.6"
          opacity="0.6"
        />
        <ellipse
          cx="1200"
          cy="120"
          rx="9"
          ry="27"
          transform="rotate(0 1200 120)"
          strokeWidth="2"
          opacity="0.6"
        />
        <ellipse
          cx="1183"
          cy="105"
          rx="8"
          ry="22"
          transform="rotate(-45 1183 105)"
          strokeWidth="2"
          opacity="0.55"
        />
        <ellipse
          cx="1217"
          cy="105"
          rx="8"
          ry="22"
          transform="rotate(45 1217 105)"
          strokeWidth="2"
          opacity="0.5"
        />

        <circle
          cx="255"
          cy="310"
          r="4"
          fill="hsl(var(--primary))"
          stroke="none"
          opacity="0.46"
        />

        <circle
          cx="355"
          cy="350"
          r="2.5"
          fill="hsl(var(--primary))"
          stroke="none"
          opacity="0.36"
        />

        <circle
          cx="665"
          cy="250"
          r="4"
          fill="hsl(var(--primary))"
          stroke="none"
          opacity="0.42"
        />

        <circle
          cx="830"
          cy="300"
          r="2.5"
          fill="hsl(var(--primary))"
          stroke="none"
          opacity="0.34"
        />

        <circle
          cx="1120"
          cy="340"
          r="4"
          fill="hsl(var(--primary))"
          stroke="none"
          opacity="0.40"
        />

        <path d="M 430 150 V 170" strokeWidth="1.5" opacity="0.38" />

        <path d="M 420 160 H 440" strokeWidth="1.5" opacity="0.38" />

        <path d="M 930 365 V 383" strokeWidth="1.3" opacity="0.34" />

        <path d="M 921 374 H 939" strokeWidth="1.3" opacity="0.34" />
      </g>
    </svg>
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
}: LeafProps) {
  const { scrollY } = useScroll();
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
        filter: `${blur ? `blur(${blur}px) ` : ""}saturate(1.35) brightness(0.96) contrast(1.1)`,
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

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {leaves.map((leaf, i) => (
        <Leaf key={`${leaf.src}-${i}`} {...leaf} />
      ))}

      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-cream to-transparent" />
    </div>
  );
}

function FoodPlate({ image }: { image: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const gradId = `plate-surface-${uid}`;
  const clipId = `plate-cut-${uid}`;

  return (
    <svg
      viewBox="0 0 200 200"
      role="img"
      aria-label="Piring makanan"
      className="h-full w-full drop-shadow-[0_16px_22px_-14px_rgba(27,77,50,0.55)]"
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="42%">
          <stop offset="0%" stopColor="hsl(var(--secondary))" />
          <stop offset="72%" stopColor="hsl(var(--muted))" />
          <stop offset="100%" stopColor="hsl(var(--border))" />
        </radialGradient>

        <clipPath id={clipId}>
          <circle cx="100" cy="100" r="84" />
        </clipPath>
      </defs>

      <circle cx="100" cy="100" r="92" fill={`url(#${gradId})`} />

      <circle
        cx="100"
        cy="100"
        r="92"
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth="2.5"
      />

      <circle
        cx="100"
        cy="100"
        r="88"
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth="1.5"
      />

      <circle cx="100" cy="100" r="86" fill="hsl(var(--secondary))" />

      <image
        href={image}
        x="0"
        y="0"
        width="200"
        height="200"
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${clipId})`}
      />

      <circle
        cx="100"
        cy="100"
        r="84"
        fill="none"
        stroke="hsl(var(--secondary))"
        strokeWidth="4"
      />

      <ellipse cx="80" cy="66" rx="46" ry="22" fill="#FFFFFF" opacity="0.16" />
    </svg>
  );
}
