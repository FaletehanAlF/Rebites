"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Minus,
  Plus,
  Star,
  Store,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatIDR, type ProductDetail } from "@/app/components/buyer/detail-product/data";
import { useCurrentUser } from "@/lib/current-user";
import { toast } from "@/hooks/use-toast";

const EASE = [0.22, 1, 0.36, 1] as const;

export function ProductDetailModal({
  product,
  onClose,
}: {
  product: ProductDetail;
  onClose: () => void;
}) {
  const router = useRouter();
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

  const { user, loading: authLoading } = useCurrentUser();

  const handleBuy = useCallback(() => {
    if (authLoading) return;
    if (!user) {
      toast({
        title: "Silakan login terlebih dahulu",
        description: "Anda harus login untuk melakukan pembelian.",
        variant: "default",
      });
      router.push(`/auth/login?redirect=/detail/pesanan?product=${encodeURIComponent(product.id)}&qty=${qty}`);
      return;
    }
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
    onClose();
    router.push(
      `/detail/pesanan?product=${encodeURIComponent(product.id)}&qty=${qty}`,
    );
  }, [onClose, qty, product.id, router, user, authLoading]);

  const savings = product.originalPrice - product.discountedPrice;
  const savingsPercent = Math.round((savings / product.originalPrice) * 100);
  const primaryImage = product.images[0];
  const lowStock = product.stockRemaining <= 3;

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        onClick={handleOverlayClick}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/40 p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label={`Detail produk ${product.title}`}
      >
        <motion.div
          ref={dialogRef}
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.97 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="relative flex w-full max-w-[900px] flex-col overflow-hidden rounded-2xl bg-white shadow-lg lg:max-h-[640px] lg:flex-row"
        >
          {}
          <button
            type="button"
            aria-label="Tutup detail produk"
            onClick={onClose}
            className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white transition-all hover:bg-primary-dark hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <X className="h-[18px] w-[18px]" strokeWidth={2.5} />
          </button>

          {}
          <div className="relative flex w-full items-center justify-center bg-white px-8 py-10 sm:px-10 sm:py-12 lg:w-[55%] lg:py-8">
            <div className="relative z-10 aspect-square w-full max-w-[380px] overflow-hidden rounded-2xl bg-muted shadow-sm">
              <Image
                src={primaryImage}
                alt={product.title}
                fill
                sizes="(max-width: 1024px) 90vw, 50vw"
                priority
                className="object-cover"
              />
            </div>
            {}
            {savings > 0 && (
              <div className="absolute left-5 top-5 z-10 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-white shadow-sm">
                Hemat {savingsPercent}%
              </div>
            )}
          </div>

          {}
          <div className="flex w-full flex-col p-6 sm:p-8 lg:w-[45%] lg:overflow-y-auto lg:p-8">
            {}
            <Link
              href={`/detail/toko?id=${encodeURIComponent(product.vendor.id)}`}
              onClick={onClose}
              className="inline-flex w-fit items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Store className="h-3 w-3" />
              {product.vendor.name}
              <ArrowUpRight className="h-3 w-3 opacity-50" />
            </Link>

            {}
            <h2 className="mt-4 font-display text-[clamp(1.3rem,2.5vw,1.75rem)] font-semibold leading-tight tracking-[-0.02em] text-primary">
              {product.title}
            </h2>

            {}
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "h-4 w-4",
                      i < Math.round(product.rating)
                        ? "fill-primary text-primary"
                        : "fill-foreground/10 text-foreground/10",
                    )}
                  />
                ))}
              </div>
              <span className="text-sm font-semibold text-primary">
                {product.rating.toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">
                · {product.reviewCount} ulasan
              </span>
            </div>

            {}
            <div className="mt-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
                Deskripsi
              </h3>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                {product.description}
              </p>
            </div>

            {}
            <p className="mt-5 text-xs font-medium text-primary">
              <span className={cn(
                "inline-block h-1.5 w-1.5 rounded-full mr-1.5",
                lowStock ? "bg-sale" : "bg-primary/100",
              )} />
              {lowStock ? `Stok terbatas, ${product.stockRemaining} tersisa` : `${product.stockRemaining} tersedia`}
            </p>

            {}
            <div className="mt-auto pt-6">
              <div className="border-t border-border pt-5">
                {}
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-2xl font-bold text-primary">
                    Rp{formatIDR(product.discountedPrice)}
                  </span>
                  {savings > 0 && (
                    <span className="text-sm text-muted-foreground line-through">
                      Rp{formatIDR(product.originalPrice)}
                    </span>
                  )}
                </div>

                {}
                <div className="mt-5 flex items-center gap-3">
                  {}
                  <div className="flex h-11 items-center overflow-hidden rounded-xl border border-foreground/10 bg-white">
                    <button
                      type="button"
                      aria-label="Kurangi jumlah"
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      disabled={qty <= 1}
                      className="flex h-full w-10 items-center justify-center text-foreground transition-colors hover:bg-foreground/5 disabled:opacity-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="flex h-full w-10 items-center justify-center text-sm font-semibold tabular-nums text-foreground">
                      {qty}
                    </span>
                    <button
                      type="button"
                      aria-label="Tambah jumlah"
                      onClick={() =>
                        setQty((q) => Math.min(product.stockRemaining, q + 1))
                      }
                      disabled={qty >= product.stockRemaining}
                      className="flex h-full w-10 items-center justify-center text-foreground transition-colors hover:bg-foreground/5 disabled:opacity-25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  {}
                  <button
                    type="button"
                    onClick={handleBuy}
                    disabled={added || product.stockRemaining === 0}
                    className={cn(
                      "flex h-11 flex-1 items-center justify-center rounded-full text-sm font-semibold transition-all active:scale-[0.97]",
                      product.stockRemaining === 0
                        ? "bg-foreground/10 text-muted-foreground cursor-not-allowed"
                        : added
                          ? "bg-primary text-white"
                          : "bg-primary text-white hover:bg-primary-dark",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    )}
                  >
                    {added
                      ? "Ditambahkan!"
                      : product.stockRemaining === 0
                        ? "Stok Habis"
                        : "Beli Sekarang"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
