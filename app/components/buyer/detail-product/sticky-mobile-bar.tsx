"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
<<<<<<< HEAD:app/components/detail-product/sticky-mobile-bar.tsx
import { cn } from "@/lib/utils";
import type { ProductDetail } from "@/app/components/detail-product/data";
import { formatIDR } from "@/app/components/detail-product/data";
=======
import type { ProductDetail } from "@/app/components/buyer/detail-product/data";
import { formatIDR } from "@/app/components/buyer/detail-product/data";
>>>>>>> 03895fc453211ed3758e52102f472d46a9c4db34:app/components/buyer/detail-product/sticky-mobile-bar.tsx
import { EASE } from "./anim";

export function StickyMobileBar({
  product,
  ctaRef,
  onOrder,
}: {
  product: ProductDetail;
  ctaRef: React.RefObject<HTMLDivElement>;
  onOrder: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const reduce = useReducedMotion();
  // Sumber kebenaran stok adalah angka; tombol pesan disabled saat habis.
  const isOutOfStock = product.stockRemaining <= 0;

  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      setVisible(rect.bottom < 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [ctaRef]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: reduce ? 0 : "100%" }}
          animate={{ y: 0 }}
          exit={{ y: reduce ? 0 : "100%" }}
          transition={{ duration: 0.35, ease: EASE }}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-secondary px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:hidden"
        >
          <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Hemat {product.discountPercent}%
              </p>
              <p className="flex items-baseline gap-2">
                <span className="font-display text-xl font-semibold text-primary">
                  Rp{formatIDR(product.discountedPrice)}
                </span>
                <span className="font-secondary text-sm text-muted-foreground line-through">
                  Rp{formatIDR(product.originalPrice)}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={onOrder}
              disabled={isOutOfStock}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors duration-200 active:scale-[0.98]",
                isOutOfStock
                  ? "cursor-not-allowed bg-muted text-muted-foreground"
                  : "bg-primary text-white hover:bg-primary-dark",
              )}
            >
              {isOutOfStock ? (
                <>Stok Habis</>
              ) : (
                <>
                  <ShoppingBag className="h-4 w-4" />
                  Pesan Sekarang
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
