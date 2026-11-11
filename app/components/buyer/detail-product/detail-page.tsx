"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BuyerShell } from "@/app/components/shared/buyer-shell";
import { StoreClosedModal } from "@/app/components/shared/StoreClosedModal";
import { openStoreClosedModal, useStoreClosedModal } from "@/lib/store-closed-modal-store";
import { vendorPurchaseWindowState } from "@/lib/store-hours";
import { ProductBreadcrumb } from "./product-breadcrumb";
import { ProductGallery } from "./product-gallery";
import { ProductInfo } from "./product-info";
import { ReviewSection } from "./review-section";
import { RelatedProducts } from "./related-products";
import { StickyMobileBar } from "./sticky-mobile-bar";
import type { ProductDetail, RelatedProduct, Review, } from "@/app/components/buyer/detail-product/data";
import { EASE } from "./anim";
export interface DetailProductShell {
  header?: ReactNode;
  buyerShell?: boolean;
  productPath: string;
  seeAllHref: string;
}
export default function DetailPage({ product, reviews, relatedProducts, shell, }: {
    product: ProductDetail;
    reviews: Review[];
    relatedProducts: RelatedProduct[];
    shell: DetailProductShell;
}) {
    return (<DetailPageContent product={product} reviews={reviews} relatedProducts={relatedProducts} shell={shell}/>);
}
function DetailPageContent({ product, reviews, relatedProducts, shell, }: {
    product: ProductDetail;
    reviews: Review[];
    relatedProducts: RelatedProduct[];
    shell: DetailProductShell;
}) {
    const router = useRouter();
    const storeClosedModal = useStoreClosedModal();
    const rightColRef = useRef<HTMLDivElement>(null);
    const ctaRef = useRef<HTMLDivElement>(null);
    const [toast, setToast] = useState<{
        id: number;
        message: string;
    } | null>(null);
    const notify = useCallback((message: string) => {
        setToast({ id: Date.now(), message });
    }, []);
    useEffect(() => {
        if (!toast)
            return;
        const timeout = window.setTimeout(() => setToast(null), 2400);
        return () => window.clearTimeout(timeout);
    }, [toast]);
    const handleOrder = useCallback(() => {
        const storeStatus = vendorPurchaseWindowState({
            openHours: product.storeOpenHours,
            isOpen: product.storeIsOpen,
            isActive: product.storeIsActive,
        }, product.pickupTime.from, product.pickupTime.to);
        if (storeStatus.closed) {
            openStoreClosedModal(storeStatus.from, storeStatus.to);
            return;
        }
        router.push(`/detail/pesanan?product=${encodeURIComponent(product.id)}`);
    }, [router, product]);
    const handleShare = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            notify("Link produk disalin ke clipboard");
        }
        catch {
            notify("Gagal menyalin link");
        }
    }, [notify]);
    const page = (<div className="relative min-h-screen overflow-x-clip bg-secondary text-foreground">

      {shell.header}


      <main className="relative mx-auto max-w-[1200px] px-4 pb-20 pt-4 sm:px-8 sm:pb-10 sm:pt-6 lg:pt-8">

        <ProductBreadcrumb product={product} onShare={handleShare}/>



        <div className="mt-3 grid items-start gap-5 sm:mt-8 sm:gap-10 lg:grid-cols-2 lg:gap-16">

          <div className="lg:sticky lg:top-28">

            <ProductGallery product={product} scrollTargetRef={rightColRef}/>

          </div>



          <div ref={rightColRef} className="min-w-0">

            <ProductInfo product={product} ctaRef={ctaRef} onOrder={handleOrder}/>

          </div>

        </div>



        <ReviewSection reviews={reviews} product={product}/>

        <RelatedProducts products={relatedProducts} productPath={shell.productPath} seeAllHref={shell.seeAllHref}/>

      </main>



      <StickyMobileBar product={product} ctaRef={ctaRef} onOrder={handleOrder}/>

      <StoreClosedModal isOpen={storeClosedModal.isOpen} onClose={storeClosedModal.close} availableFrom={storeClosedModal.availableFrom} availableTo={storeClosedModal.availableTo}/>

      <AnimatePresence>

        {toast && (<motion.div key={toast.id} initial={{ opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }} transition={{ duration: 0.25, ease: EASE }} role="status" className="fixed bottom-24 right-4 z-[70] rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-xl lg:bottom-6 lg:right-6">

            {toast.message}

          </motion.div>)}

      </AnimatePresence>




    </div>);
    return shell.buyerShell ? (<BuyerShell showBottomNav={false}>{page}</BuyerShell>) : (page);
}
