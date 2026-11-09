"use client";
import Link from "next/link";
import { ArrowRight, Leaf } from "lucide-react";
import type { VendorInfo } from "@/app/components/detail-product/data";
import { Avatar } from "./avatar";
import { Stars } from "./stars";
export function VendorMiniCard({ vendor }: {
    vendor: VendorInfo;
}) {
    return (<div className="flex flex-col gap-4 rounded-2xl bg-muted p-5 sm:flex-row sm:items-center sm:justify-between">

      <div className="flex items-center gap-4">

        <Avatar name={vendor.name} src={vendor.avatar} className="h-14 w-14"/>

        <div className="min-w-0">

          <div className="flex flex-wrap items-center gap-2">

            <p className="truncate font-sans text-base font-semibold text-foreground">

              {vendor.name}

            </p>

            {vendor.isRescuePartner && (<span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">

                <Leaf className="h-3 w-3"/>

                UMKM Penyelamat Makanan

              </span>)}

          </div>

          <div className="mt-1 flex items-center gap-1.5">

            <Stars rating={vendor.rating} size={13}/>

            <span className="text-xs font-medium text-muted-foreground">

              {vendor.rating.toFixed(1)}

            </span>

          </div>

        </div>

      </div>



      <Link href={`/detail/toko?id=${encodeURIComponent(vendor.id)}`} className="group inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border border-primary/30 px-4 py-2 text-sm font-semibold text-primary transition-colors duration-200 hover:bg-primary-dark hover:text-white sm:self-auto">

        Lihat Toko

        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"/>

      </Link>

    </div>);
}
