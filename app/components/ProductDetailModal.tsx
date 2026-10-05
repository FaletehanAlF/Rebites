"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Minus,
  Plus,
  Star,
  X,
  Clock,
  MapPin,
  Truck,
  Shield,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatIDR, type ProductDetail } from "@/app/detail/product/data";

const EASE = [0.22, 1, 0.36, 1] as const;

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50";

export function ProductDetailModal({
  product,
  onClose,
}: {
  product: ProductDetail;
  onClose: () => void;
}) {
  const router = useRouter();
  const [imageIdx, setImageIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);


  useEffect(() => {
    prevFocusRef.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey);

    requestAnimationFrame(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>("button, [tabindex]")
        ?.focus();
    });

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
      prevFocusRef.current?.focus();
    };
  }, [onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose],
  );

  const handleAddToCart = useCallback(() => {
    onClose();
    router.push(
      `/detail/pesanan?product=${encodeURIComponent(product.id)}&qty=${qty}`,
    );
  }, [onClose, qty, product.id, router]);

  const savings = product.originalPrice - product.discountedPrice;
  const savingsPercent = Math.round((savings / product.originalPrice) * 100);

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        onClick={handleOverlayClick}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-charcoal-900/40 p-4 backdrop-blur-sm sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label={`Detail produk ${product.title}`}
      >
        <motion.div
          ref={dialogRef}
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="relative flex h-full max-h-[90vh] w-full max-w-[1100px] flex-col overflow-hidden rounded-[28px] border border-sage-100 bg-cream-50 shadow-[0_40px_80px_-20px_rgba(47,66,53,0.35)] lg:max-h-[760px] lg:flex-row"
        >
          { }
          <button
            type="button"
            aria-label="Tutup detail produk"
            onClick={onClose}
            className={cn(
              "absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-charcoal-900 shadow-md backdrop-blur-sm transition-all duration-200 hover:bg-white hover:shadow-lg hover:scale-105",
              FOCUS_RING,
            )}
          >
            <X className="h-5 w-5" />
          </button>

          { }
          <div className="relative flex flex-col lg:w-[45%]">
            { }
            <div className="relative aspect-square flex-1 bg-cream-100 p-6 sm:p-10">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={imageIdx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="relative h-full w-full"
                >
                  <Image
                    src={product.images[imageIdx]}
                    alt={`${product.title} - foto ${imageIdx + 1}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 45vw"
                    priority
                    className="object-contain"
                  />
                </motion.div>
              </AnimatePresence>

              { }
              <div className="absolute left-4 top-4 rounded-full bg-sale px-3 py-1.5 text-xs font-bold text-white shadow-lg">
                Hemat {savingsPercent}%
              </div>
            </div>

            { }
            <div className="flex items-center gap-3 bg-cream-50 px-6 py-4">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Lihat foto ${i + 1}`}
                  onClick={() => setImageIdx(i)}
                  className={cn(
                    "relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border-2 transition-all duration-200 sm:h-[80px] sm:w-[80px]",
                    i === imageIdx
                      ? "border-primary shadow-md shadow-primary/15"
                      : "border-transparent opacity-60 hover:opacity-100",
                    FOCUS_RING,
                  )}
                >
                  <Image
                    src={img}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          { }
          <div className="flex flex-1 flex-col overflow-y-auto px-7 py-7 sm:px-9 lg:px-10 lg:py-8">
            { }
            <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-stone">
              {product.category}
            </p>

            { }
            <h2 className="mt-2 font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.02em] text-primary">
              {product.title}
            </h2>

            { }
            <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-charcoal-500">
              <span>oleh</span>
              <Link
                href={`/detail/toko?id=${encodeURIComponent(product.vendor.id)}`}
                onClick={onClose}
                className={cn(
                  "group inline-flex items-center gap-1 rounded-full font-medium text-charcoal-900 underline-offset-4 transition-colors hover:text-caramel hover:underline",
                  FOCUS_RING,
                )}
              >
                {product.vendor.name}
                <ArrowUpRight className="h-3.5 w-3.5 text-charcoal-500 transition-colors group-hover:text-caramel" />
              </Link>
            </p>

            { }
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-charcoal-500">
              <span className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-4 w-4",
                      i < Math.round(product.rating)
                        ? "fill-caramel text-caramel"
                        : "text-sage-100",
                    )}
                  />
                ))}
                <span className="ml-0.5 font-semibold text-charcoal-900">
                  {product.rating.toFixed(1)}
                </span>
              </span>
              <span aria-hidden className="text-sage">
                ·
              </span>
              <span>{product.reviewCount} ulasan</span>
              <span aria-hidden className="text-sage">
                ·
              </span>
              <span
                className={cn(
                  "font-medium",
                  product.stockRemaining <= 3
                    ? "text-sale"
                    : "text-primary",
                )}
              >
                {product.stockLabel}
              </span>
            </div>

            { }
            <div className="mt-5 flex flex-wrap items-baseline gap-3">
              <span className="font-display text-[clamp(1.75rem,3vw,2.25rem)] font-semibold tracking-tight text-primary">
                Rp{formatIDR(product.discountedPrice)}
              </span>
              <span className="text-base text-charcoal-500 line-through">
                Rp{formatIDR(product.originalPrice)}
              </span>
              <span className="rounded-full bg-sale/10 px-2.5 py-0.5 text-xs font-bold text-sale">
                -{savingsPercent}%
              </span>
            </div>

            { }
            <p className="mt-4 max-w-md font-inter text-[15px] leading-relaxed text-charcoal-500">
              {product.description}
            </p>

            { }
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-100 px-3 py-1.5 text-xs font-medium text-charcoal-500">
                <Clock className="h-3.5 w-3.5 text-primary" />
                {product.pickupTime.from}–{product.pickupTime.to}
              </span>
              {/* 7B-1: jarak hanya tampil jika angka nyata; NULL disembunyikan. */}
              {typeof product.distanceKm === 'number' && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-100 px-3 py-1.5 text-xs font-medium text-charcoal-500">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  {product.distanceKm} km
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cream-100 px-3 py-1.5 text-xs font-medium text-charcoal-500">
                <Truck className="h-3.5 w-3.5 text-primary" />
                Ambil sendiri
              </span>
            </div>

            { }
            <div className="flex-1" />

            { }
            <div className="mt-6 flex items-center gap-3">
              { }
              <div className="flex h-[52px] items-center overflow-hidden rounded-full border border-hairline bg-white shadow-sm">
                <button
                  type="button"
                  aria-label="Kurangi jumlah"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                  className={cn(
                    "flex h-full w-12 items-center justify-center text-lg font-medium text-charcoal-500 transition-colors hover:bg-cream-100 disabled:opacity-30",
                    FOCUS_RING,
                  )}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="flex h-full w-10 items-center justify-center text-sm font-semibold tabular-nums text-charcoal-900">
                  {qty}
                </span>
                <button
                  type="button"
                  aria-label="Tambah jumlah"
                  onClick={() =>
                    setQty((q) => Math.min(product.stockRemaining, q + 1))
                  }
                  disabled={qty >= product.stockRemaining}
                  className={cn(
                    "flex h-full w-12 items-center justify-center text-lg font-medium text-charcoal-500 transition-colors hover:bg-cream-100 disabled:opacity-30",
                    FOCUS_RING,
                  )}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              { }
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={added}
                className={cn(
                  "flex h-[52px] flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-primary px-6 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary hover:shadow-xl active:scale-[0.98] sm:flex-none sm:min-w-[180px]",
                  added && "bg-primary",
                  FOCUS_RING,
                )}
              >
                {added ? (
                  <>
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Ditambahkan!
                  </>
                ) : (
                  "Beli"
                )}
              </button>
            </div>

            { }
            <div className="mt-4 flex items-center gap-1.5 text-xs text-charcoal-500">
              <Shield className="h-3.5 w-3.5 text-primary" />
              Pembayaran aman · Ambil sendiri di lokasi mitra
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
