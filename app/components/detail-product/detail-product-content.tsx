"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import DetailPage, {
  type DetailProductShell,
} from "@/app/components/detail-product/detail-page";
import type {
  ProductDetail,
  RelatedProduct,
  Review,
} from "@/app/components/detail-product/data";
import { fetchProductDetail, fetchRelatedProducts } from "./detail-data";
import { getProductReviews } from "@/lib/review-storage";

/**
 * Fetches one product (plus its reviews and related products) and renders it
 * inside the shell the calling route provides. The shell is the only thing
 * that differs between the application route (`/detail/product`) and the
 * public showcase route (`/preview/product`).
 */
export function DetailProductContent({
  shell,
}: {
  shell: DetailProductShell;
}) {
  const searchParams = useSearchParams();
  const productId = searchParams.get("id") ?? searchParams.get("slug");

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<RelatedProduct[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "not-found">(
    "loading"
  );

  useEffect(() => {
    if (!productId) {
      setStatus("not-found");
      return;
    }
    let active = true;
    setStatus("loading");

    fetchProductDetail(productId).then((detail) => {
      if (!active) return;
      if (!detail) {
        setStatus("not-found");
        return;
      }
      setProduct(detail);
      setStatus("ready");
    });

    return () => {
      active = false;
    };
  }, [productId]);

  useEffect(() => {
    if (!product) return;
    let active = true;

    getProductReviews(product.slug).then((rows) => {
      if (active) setReviews(rows);
    });
    fetchRelatedProducts(product.category, product.slug).then((rows) => {
      if (active) setRelatedProducts(rows);
    });

    return () => {
      active = false;
    };
  }, [product]);

  if (status === "loading") {
    return <div className="min-h-screen bg-secondary" />;
  }

  if (status === "not-found" || !product) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-secondary px-6 text-center">
        <p className="font-sans text-lg font-bold text-foreground">
          Produk tidak ditemukan
        </p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          Menu yang kamu cari mungkin sudah habis atau dihapus penjualnya.
        </p>
        <a
          href="/"
          className="mt-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
        >
          Kembali ke Beranda
        </a>
      </div>
    );
  }

  return (
    <DetailPage
      product={product}
      reviews={reviews}
      relatedProducts={relatedProducts}
      shell={shell}
    />
  );
}
