"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Share2 } from "lucide-react";
import type { ProductDetail } from "@/app/components/buyer/detail-product/data";

export function ProductBreadcrumb({
  product,
  onShare,
}: {
  product: ProductDetail;
  onShare: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromPage = searchParams.get("from") === "home"
    ? "/home"
    : searchParams.get("from") === "toko"
      ? `/detail/toko?id=${encodeURIComponent(product.vendor.id)}`
      : searchParams.get("from") === "makanan"
        ? "/makanan"
        : "/";
  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fromPage);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-4 py-2 font-secondary text-sm font-semibold text-foreground transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </button>

        <nav
          aria-label="Breadcrumb"
          className="hidden min-w-0 items-center gap-2 md:flex"
        >
          <Link
            href={fromPage}
            className="truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-primary"
          >
            {product.category}
          </Link>
          <span aria-hidden className="text-muted-foreground/70">
            ·
          </span>
          <Link
            href={`/detail/toko?id=${encodeURIComponent(product.vendor.id)}`}
            className="truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-primary"
          >
            {product.vendor.name}
          </Link>
        </nav>
      </div>

      <button
        type="button"
        aria-label="Bagikan produk"
        onClick={onShare}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-white text-muted-foreground transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Share2 className="h-4 w-4" />
      </button>
    </div>
  );
}
