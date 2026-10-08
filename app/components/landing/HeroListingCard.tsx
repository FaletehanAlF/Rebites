import Link from 'next/link';
import { Clock, MapPin, Star } from 'lucide-react';
import { SmartImage } from '@/app/components/shared/SmartImage';
import { formatRupiah } from '@/lib/data';
import { cn } from '@/lib/utils';
import type { FoodItem } from '@/lib/types';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Cuplikan satu listing katalog nyata untuk hero.
 *
 * Murni presentational: `HeroSection` yang memilih produknya (lihat
 * `featured-products.ts`) sehingga komponen ini tidak pernah merender kartu
 * ketika datanya kosong — tidak ada produk palsu, tidak ada harga karangan
 * (AGENTS.md §11). Tautan menuju preview publik `/preview/product`, bukan
 * rute aplikasi ber-akun.
 */
export function HeroListingCard({ item }: { item: FoodItem }) {
  const hasDiscount =
    item.originalPrice > 0 && item.originalPrice > item.discountedPrice;

  return (
    <Link
      href={`/preview/product?id=${encodeURIComponent(item.id)}`}
      aria-label={`Lihat menu ${item.name} dari ${item.vendorName}`}
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-[0_30px_60px_-40px_rgba(27,77,50,0.75)] transition-colors duration-300 hover:border-primary/40',
        FOCUS_RING,
      )}
    >
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-muted">
        <SmartImage
          src={item.image}
          alt={item.name}
          sizes="(min-width: 1024px) 18rem, (min-width: 640px) 28rem, calc(100vw - 2rem)"
          className="transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
        {item.discountPercent > 0 && (
          <span className="absolute left-3 top-3 rounded-full bg-sale px-2 py-0.5 font-display text-[11px] font-bold text-white">
            -{item.discountPercent}%
          </span>
        )}
      </div>

      <div className="flex flex-col p-4">
        <p className="font-secondary text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {item.category}
        </p>
        <p className="mt-1 line-clamp-1 font-display text-sm font-semibold tracking-tight text-primary">
          {item.name}
        </p>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
          {item.vendorName}
        </p>

        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-display text-base font-bold tracking-tight text-primary">
            {formatRupiah(item.discountedPrice)}
          </span>
          {hasDiscount && (
            <span className="text-xs text-muted-foreground line-through">
              {formatRupiah(item.originalPrice)}
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-primary text-primary" aria-hidden />
            <span className="font-medium text-primary">{item.rating}</span>
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {item.distanceKm} km
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {item.availableFrom}&ndash;{item.availableTo}
          </span>
        </div>
      </div>
    </Link>
  );
}
