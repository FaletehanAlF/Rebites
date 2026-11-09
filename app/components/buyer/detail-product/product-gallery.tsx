"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { ChevronLeft, ChevronRight, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductDetail } from "@/app/components/buyer/detail-product/data";
import { EASE } from "./anim";

export function ProductGallery({
  product,
  scrollTargetRef,
}: {
  product: ProductDetail;
  scrollTargetRef: React.RefObject<HTMLDivElement>;
}) {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();
  const dragX = useMotionValue(0);
  const count = product.images.length;

  const { scrollYProgress } = useScroll({
    target: scrollTargetRef,
    offset: ["start end", "end start"],
  });
  const kenburns = useTransform(scrollYProgress, [0, 1], [0.97, 1.03]);

  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);
  const prev = useCallback(
    () => setIndex((i) => (i - 1 + count) % count),
    [count],
  );

  const handleDragEnd = useCallback(
    (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (info.offset.x < -50) next();
      else if (info.offset.x > 50) prev();
      animate(dragX, 0, { type: "spring", stiffness: 400, damping: 40 });
    },
    [next, prev, dragX],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      prev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    }
  };

  const lowStock = product.stockRemaining <= 3;

  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Galeri foto produk"
      onKeyDown={handleKeyDown}
      className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-muted shadow-sm">
        <div className="absolute left-4 top-4 z-20 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm">
          Hemat {product.discountPercent}%
        </div>

        <button
          type="button"
          aria-label="Foto sebelumnya"
          onClick={prev}
          className={cn(
            "absolute left-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-secondary/90 text-primary shadow-md transition-all duration-200 hover:scale-105 hover:bg-white sm:flex",
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          )}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Foto berikutnya"
          onClick={next}
          className={cn(
            "absolute right-3 top-1/2 z-20 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-secondary/90 text-primary shadow-md transition-all duration-200 hover:scale-105 hover:bg-white sm:flex",
            "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          )}
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <motion.div
          drag={reduce ? false : "x"}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          dragMomentum={false}
          onDragEnd={handleDragEnd}
          style={{ x: dragX }}
          className="h-full w-full"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={index}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: EASE }}
              className="relative h-full w-full"
            >
              <motion.div
                style={{ scale: reduce ? 1 : kenburns }}
                className="relative h-full w-full"
              >
                <Image
                  src={product.images[index]}
                  alt={`${product.title} - foto ${index + 1}`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority={index === 0}
                  className="scale-[1.08] object-cover"
                />
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <motion.div
          animate={lowStock && !reduce ? { scale: [1, 1.04, 1] } : undefined}
          transition={
            lowStock && !reduce
              ? { duration: 2, repeat: Infinity, ease: "easeInOut" }
              : undefined
          }
          className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        >
          <Package className="h-3.5 w-3.5" />
          {product.stockLabel}
        </motion.div>

        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5">
          {product.images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ke foto ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === index
                  ? "w-6 bg-primary"
                  : "w-2 bg-secondary/70 hover:bg-secondary",
              )}
            />
          ))}
        </div>

        <span aria-live="polite" className="sr-only">
          Foto {index + 1} dari {count}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2 sm:gap-3">
        {product.images.map((image, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Tampilkan foto ${i + 1}`}
            onClick={() => setIndex(i)}
            className={cn(
              "relative aspect-square overflow-hidden rounded-xl border-2 bg-muted transition-all duration-200",
              i === index
                ? "border-primary ring-2 ring-primary/20"
                : "border-transparent opacity-70 hover:opacity-100",
            )}
          >
            <Image
              src={image}
              alt=""
              fill
              sizes="80px"
              className="object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
