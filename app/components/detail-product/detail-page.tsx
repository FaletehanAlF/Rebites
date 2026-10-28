"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ProfileNavbar } from "@/app/components/shared/navbar";
import { MobileNavbar } from "@/app/components/shared/MobileNavbar";
import { SiteFooter } from "@/app/components/site-footer";
import { CartProvider, useCart } from "./cart-context";
import { PageOrnaments } from "./page-ornaments";
import { ProductBreadcrumb } from "./product-breadcrumb";
import { ProductGallery } from "./product-gallery";
import { ProductInfo } from "./product-info";
import { ReviewSection } from "./review-section";
import { RelatedProducts } from "./related-products";
import { StickyMobileBar } from "./sticky-mobile-bar";
import type {
  ProductDetail,
  RelatedProduct,
  Review,
} from "@/app/components/detail-product/data";
import { EASE } from "./anim";

export default function DetailPage({
  product,
  reviews,
  relatedProducts,
}: {
  product: ProductDetail;
  reviews: Review[];
  relatedProducts: RelatedProduct[];
}) {
  return (
    <CartProvider>
      <DetailPageContent
        product={product}
        reviews={reviews}
        relatedProducts={relatedProducts}
      />
    </CartProvider>
  );
}

function DetailPageContent({
  product,
  reviews,
  relatedProducts,
}: {
  product: ProductDetail;
  reviews: Review[];
  relatedProducts: RelatedProduct[];
}) {
  const router = useRouter();
  const rightColRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(
    null,
  );
  const { addToCart } = useCart();

  const notify = useCallback((message: string) => {
    setToast({ id: Date.now(), message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleOrder = useCallback(() => {
    addToCart(product);
    notify("Ditambahkan ke keranjang");
    router.push(`/detail/pesanan?product=${encodeURIComponent(product.id)}`);
  }, [addToCart, notify, router, product]);

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      notify("Link produk disalin ke clipboard");
    } catch {
      notify("Gagal menyalin link");
    }
  }, [notify]);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-secondary text-foreground">
      <PageOrnaments />
      <div className="lg:hidden"><MobileNavbar /></div>
      <div className="hidden lg:block"><ProfileNavbar /></div>

      <main className="relative mx-auto max-w-[1200px] px-4 pb-20 pt-[120px] sm:px-8 sm:pb-10 sm:pt-24 lg:pt-28">
        <ProductBreadcrumb product={product} onShare={handleShare} />

        <div className="mt-3 grid items-start gap-5 sm:mt-8 sm:gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="lg:sticky lg:top-28">
            <ProductGallery product={product} scrollTargetRef={rightColRef} />
          </div>

          <div ref={rightColRef} className="min-w-0">
            <ProductInfo
              product={product}
              ctaRef={ctaRef}
              onOrder={handleOrder}
              notify={notify}
            />
          </div>
        </div>

        <ReviewSection reviews={reviews} product={product} />
        <RelatedProducts products={relatedProducts} />
      </main>

      <StickyMobileBar
        product={product}
        ctaRef={ctaRef}
        onOrder={handleOrder}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.25, ease: EASE }}
            role="status"
            className="fixed bottom-24 right-4 z-[70] rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-xl lg:bottom-6 lg:right-6"
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <SiteFooter />
    </div>
  );
}
