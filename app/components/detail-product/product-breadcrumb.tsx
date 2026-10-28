"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Share2 } from "lucide-react";
import type { ProductDetail } from "@/app/components/detail-product/data";

export function ProductBreadcrumb({
  product,
  onShare,
}: {
  product: ProductDetail;
  onShare: () => void;
}) {
  const searchParams = useSearchParams();
  const fromPage = searchParams.get("from") === "home" ? "/home" : "/";

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        <Link
          href={fromPage}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-sage-100 bg-white px-4 py-2 font-inter text-sm font-semibold text-charcoal-900 transition-colors duration-200 hover:text-caramel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>

        <nav
          aria-label="Breadcrumb"
          className="hidden min-w-0 items-center gap-2 md:flex"
        >
          <Link
            href={fromPage}
            className="truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-sage-500 transition-colors hover:text-caramel"
          >
            {product.category}
          </Link>
          <span aria-hidden className="text-sage-500/70">
            ·
          </span>
          <Link
            href={`/detail/toko?id=${encodeURIComponent(product.vendor.id)}`}
            className="truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-sage-500 transition-colors hover:text-caramel"
          >
            {product.vendor.name}
          </Link>
        </nav>
      </div>

      <button
        type="button"
        aria-label="Bagikan produk"
        onClick={onShare}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sage-100 bg-white text-charcoal-500 transition-colors duration-200 hover:text-caramel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50"
      >
        <Share2 className="h-4 w-4" />
      </button>
    </div>
  );
}
