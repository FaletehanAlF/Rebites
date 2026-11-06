'use client';

import { ArrowLeft, Heart } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useLikedFoods } from '@/hooks/use-liked-foods';
import { useCatalog } from '@/lib/catalog';
import type { FoodItem } from '@/lib/types';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { BuyerShell } from '@/app/components/shared/buyer-shell';

export default function SukaiPage() {
  const { foods, hydrated } = useLikedFoods();
  const { foodItems } = useCatalog();
  const catalogMap = new Map<string, FoodItem>();
  for (const f of foodItems) {
    if (f.id) catalogMap.set(String(f.id), f);
    if (f.slug) catalogMap.set(String(f.slug), f);
    if (f.rawId) catalogMap.set(String(f.rawId), f);
  }

  return (
    <BuyerShell>
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali
          </Link>
          <h1 className="font-display text-xl font-semibold text-primary sm:text-2xl">
            Makanan Disukai
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Makanan yang kamu sukai lewat tombol ❤️ di card produk.
        </p>

        {!hydrated ? (
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                aria-hidden
                className="h-28 animate-pulse rounded-2xl border border-border bg-secondary"
              />
            ))}
          </div>
        ) : foods.length === 0 ? (
          <div className="mt-10 flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-secondary/60 px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-sm">
              <Heart className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">Belum ada makanan disukai</p>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                Tekan ikon ❤️ pada card produk di Beranda atau halaman detail untuk menambah ke sini.
              </p>
            </div>
            <Link
              href="/home"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-white"
            >
              Jelajahi Makanan
              <ArrowLeft className="h-3 w-3 rotate-180" />
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {foods.map((fav) => {
              const detail =
                catalogMap.get(fav.productId) || catalogMap.get(fav.id) || null;
              const name = fav.name || detail?.name || 'Makanan';
              const image = fav.image || detail?.image || null;
              const vendor = detail?.vendorName || '';
              const price = detail
                ? (detail.discountedPrice ?? detail.originalPrice)
                : fav.price;
              const href = detail
                ? `/detail/product?id=${detail.id}`
                : fav.productId
                  ? `/detail/product?id=${fav.productId}`
                  : '/home';
              return (
                <li key={fav.id || fav.productId}>
                  <Link
                    href={href}
                    className="group flex items-center gap-3 rounded-2xl border border-zinc-100 bg-white p-3 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-border">
                      {image ? (
                        <SmartImage src={image} alt={name} sizes="64px" />
                      ) : (
                        <span className="font-display text-xl font-semibold text-primary">
                          {(name || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-display text-sm font-semibold text-foreground">
                        {name}
                      </h3>
                      {vendor && (
                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                          {vendor}
                        </p>
                      )}
                      {price != null && (
                        <p className="mt-1 text-xs font-bold text-primary">
                          Rp{Number(price).toLocaleString('id-ID')}
                        </p>
                      )}
                    </div>
                    <Heart className="h-4 w-4 shrink-0 text-sale" aria-label="Disukai" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </BuyerShell>
  );
}
