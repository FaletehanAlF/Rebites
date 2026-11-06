"use client";

import { Clock, Leaf, ShieldCheck, Store, Truck } from "lucide-react";
import type { ProductDetail } from "@/app/components/detail-product/data";
import { StaggerGroup, StaggerItem } from "./anim";

/** Ringkas metode yang benar-benar diaktifkan penjual untuk produk ini. */
function fulfillmentLabel(product: ProductDetail): string | null {
  if (product.isDelivery && product.isPickup) return "Diantar atau ambil sendiri";
  if (product.isDelivery) return "Diantar ke alamatmu";
  if (product.isPickup) return "Ambil sendiri di toko";
  return null; // penjual menonaktifkan keduanya
}

export function InfoGrid({ product }: { product: ProductDetail }) {
  const fulfillment = fulfillmentLabel(product);
  const items = [
    {
      icon: Clock,
      label: "Waktu Ambil",
      value: `${product.pickupTime.from}–${product.pickupTime.to} WIB`,
    },
    { icon: Store, label: "Titik Ambil", value: product.pickupLocation },
    // Metode pengiriman mengikuti pengaturan penjual per produk; hanya
    // ditampilkan bila ada yang aktif (tidak mengarang opsi).
    ...(fulfillment
      ? [
          {
            icon: Truck,
            label: "Metode Pengiriman",
            value: fulfillment,
          },
        ]
      : []),
    { icon: ShieldCheck, label: "Kelayakan", value: product.consumeWindow },
    {
      icon: Leaf,
      label: "Dampak",
      value: `±${product.co2eSavedKg} kg CO₂e dicegah`,
    },
  ];

  return (
    <StaggerGroup className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
      {items.map(({ icon: Icon, label, value }) => (
        <StaggerItem key={label} className="h-full">
          <div className="flex h-full items-start gap-3 rounded-2xl border border-border bg-white p-4 transition-shadow duration-300 hover:shadow-[0_18px_40px_-28px_rgba(47,66,53,0.4)] sm:gap-4 sm:p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-primary sm:h-11 sm:w-11">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {label}
              </p>
              <p className="mt-1 break-words text-sm font-semibold text-foreground">
                {value}
              </p>
            </div>
          </div>
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}
