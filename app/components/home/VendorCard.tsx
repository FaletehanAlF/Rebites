'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Crown, MapPin, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SmartImage } from '@/app/components/shared/SmartImage';
import type { Vendor } from '@/lib/types';

import { isVendorReallyOpen } from '@/lib/store-status';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50';

export function VendorCard({
  vendor,
  badgeLabel,
}: {
  vendor: Vendor;
  badgeLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    setIsOpen(isVendorReallyOpen({ isOpen: vendor.isOpen, openHours: vendor.openHours }));
  }, [vendor.isOpen, vendor.openHours]);

  return (
    <div
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white outline-none transition-all duration-300 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-lg hover:shadow-primary/10',
        FOCUS_RING
      )}
    >
      <Link
        href={`/detail/toko?id=${vendor.id}`}
        aria-label={`Lihat detail ${vendor.name}`}
        className="block"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-sage-100">
          <SmartImage
            src={vendor.image}
            alt={`Foto tampilan ${vendor.name}`}
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="transition-transform duration-500 group-hover:scale-105"
          />

          <div
            className={cn(
              'absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold leading-none shadow-md',
              isOpen ? 'bg-white text-primary' : 'bg-zinc-100 text-zinc-500'
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", isOpen ? "bg-primary" : "bg-zinc-400")} />
            {isOpen ? 'Buka' : 'Tutup'}
          </div>

          {badgeLabel ? (
            <div className="absolute left-3 top-10 flex items-center gap-1 rounded-full bg-caramel px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-charcoal-900 shadow-md">
              <Crown className="h-3 w-3" />
              {badgeLabel}
            </div>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link href={`/detail/toko?id=${vendor.id}`} className="group/title">
          <h3 className="line-clamp-1 font-sans text-[15px] font-bold leading-snug text-charcoal-900 group-hover/title:text-primary">
            {vendor.name}
          </h3>
        </Link>
        <p className="mt-0.5 line-clamp-1 font-sans text-[13px] text-charcoal-500">{vendor.category}</p>

        <div className="mt-2 flex items-center gap-2 text-xs text-charcoal-500">
          <span className="flex items-center gap-1 font-medium text-charcoal-900">
            <Star className="h-3.5 w-3.5 fill-caramel text-caramel" />
            {vendor.rating.toFixed(1)}
          </span>
          <span className="hidden h-3 w-px bg-zinc-200 sm:block" />
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-sage-500" />
            {vendor.openHours}
          </span>
        </div>
        <p className="mt-1.5 flex items-start gap-1 text-xs leading-relaxed text-charcoal-500">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sage-500" />
          <span className="line-clamp-2">{vendor.address}</span>
        </p>

        <Link
          href={`/detail/toko?id=${vendor.id}`}
          className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-caramel"
        >
          Lihat Toko
        </Link>
      </div>
    </div>
  );
}
