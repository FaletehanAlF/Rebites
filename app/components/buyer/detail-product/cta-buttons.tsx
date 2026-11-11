"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductDetail } from "@/app/components/buyer/detail-product/data";

export function CTAButtons({
  product,
  onOrder,
}: {
  product: ProductDetail;
  onOrder: () => void;
}) {
  const reduce = useReducedMotion();
  const isOutOfStock = product.stockRemaining <= 0;

  const handleOrder = () => {
    if (isOutOfStock) return;
    onOrder();
  };

  return (
    <motion.button
      type="button"
      onClick={handleOrder}
      disabled={isOutOfStock}
      whileHover={reduce || isOutOfStock ? undefined : { scale: 1.02 }}
      whileTap={reduce || isOutOfStock ? undefined : { scale: 0.98 }}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isOutOfStock
          ? "cursor-not-allowed bg-charcoal-900/10 text-charcoal-400"
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
    </motion.button>
  );
}
