"use client";
import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BuyerShell } from "@/app/components/shared/buyer-shell";
import { Hero } from "@/app/components/home/Hero";
import { UrgentDealsSection } from "@/app/components/home/UrgentDealsSection";
import { FlashSaleSection } from "@/app/components/home/FlashSaleSection";
import { CategorySection } from "@/app/components/home/CategorySection";
import { VendorSection } from "@/app/components/home/VendorSection";
import { StoreClosedModal } from "@/app/components/shared/StoreClosedModal";
import { useStoreClosedModal } from "@/lib/store-closed-modal-store";
import { RequireAuth } from "@/app/components/auth/require-auth";
import { scrollToId } from "@/lib/scroll";
function HomePageContent() {
    const router = useRouter();
    const storeClosedModal = useStoreClosedModal();
    const handleViewDetail = useCallback((id: string) => {
        router.push(`/detail/product?id=${encodeURIComponent(id)}`);
    }, [router]);
    useEffect(() => {
        const scrollToHash = () => {
            const id = window.location.hash.replace(/^#/, "");
            if (!id)
                return;
            scrollToId(id);
        };
        const timer = window.setTimeout(scrollToHash, 0);
        window.addEventListener("hashchange", scrollToHash);
        return () => {
            window.clearTimeout(timer);
            window.removeEventListener("hashchange", scrollToHash);
        };
    }, []);
    return (<BuyerShell>
      <main className="bg-white pb-20 lg:pb-0">
        <Hero />
        <CategorySection />
        <UrgentDealsSection from="home" onViewDetail={handleViewDetail}/>
        <FlashSaleSection onViewDetail={handleViewDetail}/>
        <VendorSection />
      </main>

      <StoreClosedModal isOpen={storeClosedModal.isOpen} onClose={storeClosedModal.close} availableFrom={storeClosedModal.availableFrom} availableTo={storeClosedModal.availableTo}/>
    </BuyerShell>);
}
export default function HomePage() {
    return (<RequireAuth>
      <HomePageContent />
    </RequireAuth>);
}
