"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ProductDetail } from "@/app/components/buyer/detail-product/data";
import { fetchProductDetail } from "@/app/components/buyer/detail-product/detail-data";
import type { OrderDraft } from "@/lib/types";
import { CheckoutProvider } from "./checkout-context";
import { OrderItemCard } from "./order-item-card";
import { QuantityStepperCard } from "./quantity-stepper-card";
import { FulfillmentToggle } from "./fulfillment-toggle";
import { PickupInfoCard } from "./pickup-info-row";
import { DeliveryAddressSection } from "./delivery-address-section";
import { ShippingOptionSection } from "./shipping-option-section";
import { PaymentSummaryCard } from "./payment-summary-card";
import { StickyMobileBar } from "./sticky-mobile-bar";
import { CheckoutSuccessDialog } from "./checkout-success-dialog";
import { CheckoutPriceReviewDialog } from "./checkout-price-review-dialog";
import { useCurrentUser } from "@/lib/current-user";
import { toast } from "@/hooks/use-toast";

const RESERVATION_MINUTES = 35;

function buildOrderDraft(product: ProductDetail): OrderDraft {
  return {
    productId: product.id,
    productSlug: product.slug,
    vendorName: product.vendor.name,
    vendorSlug: product.vendor.id,
    productName: product.title,
    image: product.images[0],
    originalPrice: product.originalPrice,
    discountedPrice: product.discountedPrice,
    stockRemaining: product.stockRemaining,
    distanceKm: product.distanceKm,
    isDelivery: product.isDelivery ?? true,
    isPickup: product.isPickup ?? true,
    weightGram: product.weightGram ?? null,
    lengthCm: product.lengthCm ?? null,
    widthCm: product.widthCm ?? null,
    heightCm: product.heightCm ?? null,
    pickupTime: product.pickupTime,
    pickupLocation: product.pickupLocation,
    reservedUntil: new Date(
      Date.now() + RESERVATION_MINUTES * 60 * 1000,
    ).toISOString(),
    co2ePerUnitKg: product.co2eSavedKg,
  };
}

function CheckoutContent({
  draft,
  initialQuantity,
}: {
  draft: OrderDraft;
  initialQuantity: number;
}) {
  return (
    <CheckoutProvider draft={draft} initialQuantity={initialQuantity}>
      <main className="relative min-h-screen bg-secondary pb-32 sm:pb-28 lg:pb-16">
        <div className="relative mx-auto max-w-[1400px] px-4 pt-4 sm:px-8 sm:pt-6 lg:px-12 lg:pt-10">
          {}
          <div className="flex items-center gap-3">
            <Link
              href="/home"
              aria-label="Kembali"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-primary transition-colors hover:bg-primary-dark hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </div>

          <h1 className="mt-3 font-display text-[clamp(1.5rem,5vw,3.4rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:mt-5">
            Detail pesanan
          </h1>

          <div className="mt-5 grid items-start gap-4 sm:mt-8 sm:gap-6 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:gap-10">
            {}
            <div className="space-y-3 sm:space-y-4 lg:space-y-6">
              <OrderItemCard />

              <div id="checkout-qty-card" className="scroll-mt-28">
                <QuantityStepperCard />
              </div>

              <FulfillmentToggle />

              <PickupInfoCard />
              <DeliveryAddressSection />
              <ShippingOptionSection />
            </div>

            {}
            <div className="space-y-4 lg:sticky lg:top-28 lg:self-start">
              <PaymentSummaryCard />
            </div>
          </div>
        </div>

        <StickyMobileBar />
      </main>

      <CheckoutSuccessDialog />
      <CheckoutPriceReviewDialog />
    </CheckoutProvider>
  );
}

export function CheckoutView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useCurrentUser();
  const [authChecked, setAuthChecked] = useState(false);

  const productId = searchParams.get("product");

  const [draft, setDraft] = useState<OrderDraft | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found">(
    "loading",
  );

  useEffect(() => {
    if (!authLoading) {
      setAuthChecked(true);
      if (!user) {
        toast({
          title: "Silakan login terlebih dahulu",
          description: "Anda harus login untuk melakukan pemesanan.",
          variant: "default",
        });
        const currentUrl = window.location.pathname + window.location.search;
        router.push(`/auth/login?redirect=${encodeURIComponent(currentUrl)}`);
      }
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    let active = true;
    if (!productId) {
      setStatus("not-found");
      return;
    }
    setStatus("loading");
    fetchProductDetail(productId).then((product) => {
      if (!active) return;
      if (product) {
        setDraft(buildOrderDraft(product));
        setStatus("ready");
      } else {
        setStatus("not-found");
      }
    });
    return () => {
      active = false;
    };
  }, [productId]);

  const initialQuantity = useMemo(() => {
    const raw = Number.parseInt(searchParams.get("qty") ?? "", 10);
    if (!Number.isFinite(raw)) return 1;
    return Math.min(Math.max(raw, 1), Math.max(1, draft?.stockRemaining ?? 1));
  }, [searchParams, draft?.stockRemaining]);

  if (authLoading || !authChecked) {
    return (
      <div className="min-h-screen bg-secondary flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (status === "loading") {
    return <div className="min-h-screen bg-secondary" />;
  }

  if (status === "not-found" || !draft) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-secondary px-6 text-center">
        <p className="font-sans text-lg font-bold text-foreground">
          Produk tidak ditemukan
        </p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          Menu yang akan kamu pesan sudah tidak tersedia.
        </p>
        <Link
          href="/home"
          className="mt-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          Kembali ke Beranda
        </Link>
      </main>
    );
  }

  return <CheckoutContent draft={draft} initialQuantity={initialQuantity} />;
}