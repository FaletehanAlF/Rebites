"use client";

import { Clock, Leaf, ShieldCheck, Store } from "lucide-react";
import type { ProductDetail } from "@/app/components/detail-product/data";
import { StaggerGroup, StaggerItem } from "./anim";

export function InfoGrid({ product }: { product: ProductDetail }) {
  const items = [
    {
      icon: Clock,
      label: "Waktu Ambil",
      value: `${product.pickupTime.from}–${product.pickupTime.to} WIB`,
    },
    { icon: Store, label: "Titik Ambil", value: product.pickupLocation },
    { icon: ShieldCheck, label: "Kelayakan", value: product.consumeWindow },
    {
      icon: Leaf,
      label: "Dampak",
      value: `±${product.co2eSavedKg} kg CO₂e dicegah`,
    },
  ];

  return (
    <StaggerGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map(({ icon: Icon, label, value }) => (
        <StaggerItem key={label} className="h-full">
          <div className="flex h-full items-start gap-4 rounded-2xl border border-border bg-white p-5 transition-shadow duration-300 hover:shadow-[0_18px_40px_-28px_rgba(47,66,53,0.4)]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {label}
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {value}
              </p>
            </div>
          </div>
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}
