'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, Crown, MapPin, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SmartImage } from '@/app/components/shared/SmartImage';
import type { Vendor } from '@/lib/types';

import { isVendorReallyOpen } from '@/lib/store-status';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';

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
        'group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-white outline-none transition-colors duration-300 hover:border-primary/40',
        FOCUS_RING
      )}
    >
      <Link
        href={`/detail/toko?id=${vendor.id}`}
        aria-label={`Lihat detail ${vendor.name}`}
        className="block"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <SmartImage
            src={vendor.image}
            alt={`Foto tampilan ${vendor.name}`}
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="transition-transform duration-500 group-hover:scale-105"
          />

          <div
            className={cn(
              'absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold leading-none shadow-md',
              isOpen ? 'bg-white text-primary' : 'bg-muted text-muted-foreground'
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", isOpen ? "bg-primary" : "bg-muted-foreground")} />
            {isOpen ? 'Buka' : 'Tutup'}
          </div>

          {badgeLabel ? (
            <div className="absolute left-3 top-10 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-foreground shadow-md">
              <Crown className="h-3 w-3" />
              {badgeLabel}
            </div>
          ) : null}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link href={`/detail/toko?id=${vendor.id}`} className="group/title">
          <h3 className="line-clamp-1 font-sans text-[15px] font-semibold leading-snug text-foreground group-hover/title:text-primary">
            {vendor.name}
          </h3>
        </Link>
        <p className="mt-0.5 line-clamp-1 font-sans text-[13px] text-muted-foreground">{vendor.category}</p>

        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-medium text-foreground">
            <Star className="h-3.5 w-3.5 fill-primary text-primary" />
            {vendor.rating.toFixed(1)}
          </span>
          <span className="hidden h-3 w-px bg-border sm:block" />
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            {vendor.openHours}
          </span>
        </div>
        <p className="mt-1.5 flex items-start gap-1 text-xs leading-relaxed text-muted-foreground">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="line-clamp-2">{vendor.address}</span>
        </p>

        <Link
          href={`/detail/toko?id=${vendor.id}`}
          className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-dark"
        >
          Lihat Toko
        </Link>
      </div>
    </div>
  );
}
