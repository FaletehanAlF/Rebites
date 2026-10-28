"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import type { RelatedProduct } from "@/app/components/detail-product/data";
import { formatIDR } from "@/app/components/detail-product/data";
import { StaggerGroup, StaggerItem } from "./anim";

export function RelatedProducts({ products }: { products: RelatedProduct[] }) {
  return (
    <section className="pt-20">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="font-sans text-2xl font-bold tracking-tight text-primary sm:text-3xl">
            Selamatkan Juga
          </h2>
          <p className="mt-2 max-w-md font-inter text-sm leading-relaxed text-charcoal-500">
            Masih ada porsi lain yang menunggu diselamatkan hari ini, jangan
            sampai terbuang.
          </p>
        </div>
        <Link
          href="/home"
          className="hidden items-center gap-1.5 font-inter text-sm font-semibold text-primary transition-colors hover:text-caramel sm:inline-flex"
        >
          Lihat Semua
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <StaggerGroup
        className="mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 lg:grid lg:grid-cols-5 lg:gap-5 lg:overflow-visible lg:pb-0"
        stagger={0.08}
        amount={0.1}
      >
        {products.map((product) => (
          <StaggerItem
            key={product.id}
            className="min-w-[220px] snap-start sm:min-w-[240px] lg:min-w-0"
          >
            <Link
              href={`/detail/product?id=${encodeURIComponent(product.slug)}`}
              className="group block h-full overflow-hidden rounded-2xl border border-sage-100 bg-white transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_50px_-30px_rgba(47,66,53,0.45)]"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-cream-100">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  sizes="(max-width: 1024px) 240px, 20vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sage-500">
                  {product.vendorName}
                </p>
                <p className="mt-1 truncate font-sans text-sm font-semibold text-charcoal-900">
                  {product.name}
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-sans text-base font-bold text-primary">
                    Rp{formatIDR(product.discountedPrice)}
                  </span>
                  <span className="font-inter text-xs text-charcoal-500 line-through">
                    Rp{formatIDR(product.originalPrice)}
                  </span>
                </div>
              </div>
            </Link>
          </StaggerItem>
        ))}
      </StaggerGroup>
    </section>
  );
}
